import i18n from '../i18n'

// Treningi (ćwiczenia) z bazy mają tylko polskie title/description/instructions
// + opcjonalne kolumny *_en dopisane migracją. Picks the right language at read
// time — nie psuje persistent cache (który zostaje językowo-neutralny, surowy PL+EN).
export function localizeTraining(training) {
  if (!training) return training
  if (i18n.language !== 'en') return training
  return {
    ...training,
    title: training.title_en || training.title,
    description: training.description_en || training.description,
    instructions: training.instructions_en?.length ? training.instructions_en : training.instructions,
  }
}
