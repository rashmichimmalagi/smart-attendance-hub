import { Session } from '../types';

export function getSessionEndDateTime(session: Session): Date {
  try {
    if (!session || !session.date) return new Date();
    const dateStr = session.date.trim().replace(/\//g, '-');
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return new Date();
    const [year, month, day] = parts;
    const cleanTime = (session.extendedEndTime || session.endTime || '').trim().substring(0, 5);
    const timeParts = cleanTime.split(':').map(Number);
    const hours = !isNaN(timeParts[0]) ? timeParts[0] : 0;
    const minutes = !isNaN(timeParts[1]) ? timeParts[1] : 0;
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  } catch (err) {
    console.error('[getSessionEndDateTime] Error parsing dates:', err);
    return new Date();
  }
}

export function getFeedbackClosingDateTime(session: Session): Date {
  let time = session.feedbackDeadline || session.feedbackClosingTime;

  if (!time && session.description) {
    const deadlineMatch = session.description.match(/\[feedback_deadline:\s*([^\]]+)\]/);
    if (deadlineMatch) {
      time = deadlineMatch[1].trim();
    } else {
      const closingMatch = session.description.match(/\[feedback_closing:[^\]]*time=([^;\]]+)/);
      if (closingMatch) {
        time = closingMatch[1].trim();
      }
    }
  }

  if (time) {
    const parsed = new Date(time);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Traditional default fallback: 24 hours after session end
  const endDateTime = getSessionEndDateTime(session);
  return new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
}

export function getFeedbackWindowStatus(session: Session) {
  try {
    const endDateTime = getSessionEndDateTime(session);
    const deadline = getFeedbackClosingDateTime(session);
    const now = new Date();
    
    // Feedback is available ONLY after:
    // (a) session has reached its final end time (including extensions)
    // OR
    // (b) session has been manually expired/concluded
    const isSessionEnded = session.status === 'expired' || now >= endDateTime;
    const isLocked = !isSessionEnded;
    const isExpired = isSessionEnded && now > deadline;

    // Check if feedback deadline was manually set, extended or reopened by admin
    const defaultDeadline = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
    const hasCustomDeadline = Boolean(
      session.feedbackDeadline ||
      (session.description && /\[feedback_deadline:\s*([^\]]+)\]/.test(session.description))
    );
    const isReopened = !isLocked && !isExpired && (
      hasCustomDeadline || deadline.getTime() > defaultDeadline.getTime() + 60000
    );

    let remainingText = '';
    let statusText = '';
    let badgeClass = '';

    if (isLocked) {
      remainingText = 'Feedback locked';
      statusText = '🔒 Form Locked';
      badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    } else if (isExpired) {
      remainingText = 'Feedback window expired';
      statusText = '🔴 Feedback Closed';
      badgeClass = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    } else if (isReopened) {
      const diffMs = deadline.getTime() - now.getTime();
      const hrs = Math.max(0, Math.floor(diffMs / (3600 * 1000)));
      const mins = Math.max(0, Math.floor((diffMs % (3600 * 1000)) / (60 * 1000)));
      remainingText = `${hrs}h ${mins}m left`;
      statusText = '🟢 Feedback Reopened';
      badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    } else {
      const diffMs = deadline.getTime() - now.getTime();
      const hrs = Math.max(0, Math.floor(diffMs / (3600 * 1000)));
      const mins = Math.max(0, Math.floor((diffMs % (3600 * 1000)) / (60 * 1000)));
      remainingText = `${hrs}h ${mins}m left`;
      statusText = '🟢 Feedback Open';
      badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
    
    return {
      deadline,
      isExpired,
      isLocked,
      isReopened,
      statusText,
      badgeClass,
      remainingText,
      endDateTime
    };
  } catch (err) {
    console.error('[getFeedbackWindowStatus] Error calculating window:', err);
    return {
      deadline: new Date(),
      isExpired: true,
      isLocked: true,
      isReopened: false,
      statusText: '🔴 Feedback Closed',
      badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      remainingText: 'Error parsing feedback window',
      endDateTime: new Date()
    };
  }
}
