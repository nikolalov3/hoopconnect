import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import FeedbackButton from '../components/FeedbackButton'

export default function CoachShell() {
  return (
    <div className="coach-app">
      <Sidebar />
      <div className="coach-main">
        <div className="coach-content">
          <Outlet />
        </div>
      </div>
      <FeedbackButton />
    </div>
  )
}
