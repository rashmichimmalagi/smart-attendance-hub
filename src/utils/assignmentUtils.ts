export interface AssignmentStatusInfo {
  dueDateString: string;     // e.g. "31/05/2026"
  dueTimeString: string;     // e.g. "11:59 PM"
  remainingTimeString: string; // e.g. "2h 15m left" or "3 days left"
  status: 'Open' | 'Due Soon' | 'Closed';
  isClosed: boolean;
}

export function getAssignmentStatus(deadlineIso: string): AssignmentStatusInfo {
  const deadline = new Date(deadlineIso);
  const now = new Date();
  
  // Format Date: e.g. DD/MM/YYYY
  const day = String(deadline.getDate()).padStart(2, '0');
  const month = String(deadline.getMonth() + 1).padStart(2, '0');
  const year = deadline.getFullYear();
  const dueDateString = `${day}/${month}/${year}`;
  
  // Format Time: e.g. 11:59 PM
  let hours = deadline.getHours();
  const minutes = String(deadline.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const dueTimeString = `${hours}:${minutes} ${ampm}`;

  const diffMs = deadline.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return {
      dueDateString,
      dueTimeString,
      remainingTimeString: 'Closed',
      status: 'Closed',
      isClosed: true
    };
  }

  const diffHrs = diffMs / (1000 * 60 * 60);
  let status: 'Open' | 'Due Soon' | 'Closed' = 'Open';
  if (diffHrs < 24) {
    status = 'Due Soon';
  }

  // Countdowns:
  // - If > 1 day: e.g. "3 days left"
  // - If < 1 day but > 1 hour: e.g. "12 hours left" or "2h 15m left"
  // - If < 1 hour: e.g. "45 minutes left"
  let remainingTimeString = '';
  if (diffHrs >= 48) {
    const days = Math.floor(diffHrs / 24);
    remainingTimeString = `${days} days left`;
  } else if (diffHrs >= 24) {
    remainingTimeString = `1 day left`;
  } else if (diffHrs >= 1) {
    const hrs = Math.floor(diffHrs);
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (mins > 0) {
      remainingTimeString = `${hrs}h ${mins}m left`;
    } else {
      remainingTimeString = `${hrs} hours left`;
    }
  } else {
    const mins = Math.floor(diffMs / (1000 * 60));
    remainingTimeString = `${mins > 0 ? mins : 1} minutes left`;
  }

  return {
    dueDateString,
    dueTimeString,
    remainingTimeString,
    status,
    isClosed: false
  };
}
