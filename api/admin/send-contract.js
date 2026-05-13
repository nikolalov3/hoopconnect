/**
 * POST /api/admin/send-contract
 *
 * Body (JSON):
 *   {
 *     to:           string,           // recipient email
 *     subject:      string,
 *     body:         string,           // plain-text
 *     pdf_base64:   string,           // PDF zakodowany base64
 *     pdf_filename: string            // np. 'umowa_uks-polonia_2026-05-13.pdf'
 *   }
 *
 * Headers:
 *   Authorization: Bearer <supabase_jwt>
 *
 * Endpoint weryfikuje JWT przez Supabase i wpuszcza tylko email z whitelisty.
 * Bez whitelisty / niezalogowany → 401.
 *
 * SMTP creds z env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_FROM_NAME.
 */
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'kontakt@hoopconnect.pl'

export default async function handler(req, res) {
  // CORS — apka wywołuje to z gu.hoopconnect.pl; Vercel domyślnie blokuje
  // cross-origin requests jeśli nie ustawimy headerów. Tutaj sami sobie
  // ufamy (whitelist po JWT), więc allow.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  // 1. Auth — weryfikuj JWT i sprawdź email
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'missing token' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return res.status(500).json({ error: 'supabase env not configured' })
  }
  const supa = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: authErr } = await supa.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'invalid token' })
  if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'forbidden' })
  }

  // 2. Parse body
  const { to, subject, body, pdf_base64, pdf_filename } = req.body || {}
  if (!to || !subject || !body || !pdf_base64 || !pdf_filename) {
    return res.status(400).json({ error: 'missing fields' })
  }

  // 3. SMTP
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '465', 10)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASSWORD
  const fromAddr = process.env.SMTP_FROM || smtpUser
  const fromName = process.env.SMTP_FROM_NAME || 'HoopConnect'
  if (!host || !smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'SMTP env not configured' })
  }

  const transporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,        // implicit TLS on 465, STARTTLS on 587
    auth: { user: smtpUser, pass: smtpPass },
  })

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to,
      subject,
      text: body,
      attachments: [{
        filename: pdf_filename,
        content: Buffer.from(pdf_base64, 'base64'),
        contentType: 'application/pdf',
      }],
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[send-contract] SMTP error:', e)
    return res.status(502).json({ error: e.message || 'SMTP error' })
  }
}

// Vercel: zwiększ limit body dla PDF base64
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
}
