import { useMemo, useState } from 'react';
import { Activity, Check, Plus, UserRound } from 'lucide-react';

const dateKey = (date, timezone) => new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

const formatDate = (date, timezone, options) => new Intl.DateTimeFormat('en-US', {
  timeZone: timezone, ...options,
}).format(date);

const makeEvents = (tasks, timezone) => tasks.flatMap((task) => {
  const events = [];
  if (task.createdAt) events.push({
    id: `${task._id}-created`, task, kind: 'created', date: new Date(task.createdAt),
  });
  if (task.completedAt) events.push({
    id: `${task._id}-completed`, task, kind: 'completed', date: new Date(task.completedAt),
  });
  return events.filter((event) => !Number.isNaN(event.date.getTime()))
    .map((event) => ({ ...event, day: dateKey(event.date, timezone) }));
}).sort((a, b) => b.date - a.date);

function ContributionGrid({ year, events }) {
  const { weeks, monthLabels, counts } = useMemo(() => {
    const firstOfYear = new Date(Date.UTC(year, 0, 1));
    const start = new Date(firstOfYear);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const lastOfYear = new Date(Date.UTC(year, 11, 31));
    const end = new Date(lastOfYear);
    end.setUTCDate(end.getUTCDate() + 6 - end.getUTCDay());
    const days = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      days.push({
        key: cursor.toISOString().slice(0, 10),
        inYear: cursor.getUTCFullYear() === year,
      });
    }
    const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
    const monthLabels = Array.from({ length: 12 }, (_, month) => ({
      month,
      week: Math.floor((Date.UTC(year, month, 1) - start.getTime()) / (7 * 864e5)),
    }));
    const counts = new Map();
    events.forEach((event) => {
      if (event.day.startsWith(`${year}-`)) counts.set(event.day, (counts.get(event.day) || 0) + 1);
    });
    return { weeks, monthLabels, counts };
  }, [year, events]);

  const level = (count) => count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

  return (
    <section className="profile-panel contribution-panel">
      <div className="profile-section-heading">
        <div>
          <h2>{total.toLocaleString()} contributions in {year}</h2>
          <p>Tasks created and completed in Tasxity</p>
        </div>
        <span className="profile-contribution-total"><Activity size={15} /> {total.toLocaleString()}</span>
      </div>
      <div className="contribution-scroll">
        <div className="contribution-calendar" role="img" aria-label={`Task contributions during ${year}`}>
          <div className="contribution-months" style={{ '--week-count': weeks.length }}>
            {monthLabels.map(({ month, week }) => (
              <span key={month} style={{ gridColumn: `${week + 1} / span 4` }}>
                {new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
              </span>
            ))}
          </div>
          <div className="contribution-body">
            <div className="contribution-weekdays" aria-hidden="true">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            <div className="contribution-weeks" style={{ '--week-count': weeks.length }}>
              {weeks.map((week) => (
                <div className="contribution-week" key={week[0].key}>
                  {week.map(({ key, inYear }) => {
                    const count = inYear ? counts.get(key) || 0 : 0;
                    const date = new Date(`${key}T12:00:00Z`);
                    const label = `${count} ${count === 1 ? 'contribution' : 'contributions'} on ${formatDate(date, 'UTC', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}`;
                    return <span key={key} className={`contribution-day level-${level(count)} ${inYear ? '' : 'outside-year'}`}
                      title={label} aria-label={label} />;
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="contribution-legend">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((item) => <i key={item} className={`contribution-day level-${item}`} />)}
            <span>More</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ProfilePage({ user, tasks, projects, timezone }) {
  const [currentYear] = useState(() => new Date().getFullYear());
  const [year, setYear] = useState(currentYear);
  const [visibleCount, setVisibleCount] = useState(10);
  const events = useMemo(() => makeEvents(tasks, timezone), [tasks, timezone]);
  const yearEvents = events.filter((event) => event.day.startsWith(`${year}-`));
  const activityMonths = [];
  yearEvents.forEach((event) => {
    const month = formatDate(event.date, timezone, { month: 'long', year: 'numeric' });
    const existing = activityMonths.at(-1);
    if (existing?.month === month) existing.events.push(event);
    else activityMonths.push({ month, events: [event] });
  });
  const initials = user.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const createdCount = tasks.filter((task) => task.createdAt).length;
  const displayedEvents = yearEvents.slice(0, visibleCount);

  return (
    <section className="profile-page">
      <header className="profile-heading">
        <div className="profile-identity">
          <div className="profile-avatar">{initials || <UserRound size={24} />}</div>
          <div>
            <p className="greet">Your Tasxity profile</p>
            <h1>{user.name}</h1>
            <p className="muted">{user.isGuest ? 'Guest account · your workspace is separate' : user.email}</p>
          </div>
        </div>
        <div className="profile-stats">
          <div><b>{completedCount}</b><span>Tasks completed</span></div>
          <div><b>{createdCount}</b><span>Tasks created</span></div>
          <div><b>{projects.length}</b><span>Workspaces</span></div>
        </div>
      </header>

      <div className="profile-activity-layout">
        <div className="profile-main-column">
          <ContributionGrid year={year} events={events} />
          <section className="profile-activity">
            <div className="profile-section-heading profile-activity-heading">
              <div><h2>Contribution activity</h2><p>Your task activity, organized by month</p></div>
              <label className="profile-year-select">
                <span className="sr-only">Activity year</span>
                <select className="select" value={year} onChange={(event) => { setYear(Number(event.target.value)); setVisibleCount(10); }}>
                  {Array.from({ length: 5 }, (_, index) => currentYear - index).map((activityYear) => (
                    <option key={activityYear} value={activityYear}>{activityYear}</option>
                  ))}
                </select>
              </label>
            </div>
            {displayedEvents.length ? (
              <div className="profile-event-list">
                {activityMonths.map(({ month, events: monthEvents }) => {
                  const visibleMonthEvents = monthEvents.filter((event) => displayedEvents.includes(event));
                  if (!visibleMonthEvents.length) return null;
                  return (
                    <section className="profile-month" key={month}>
                      <h3>{month}</h3>
                      {visibleMonthEvents.map((event) => (
                        <article className="profile-event" key={event.id}>
                          <span className={`profile-event-icon ${event.kind}`}>
                            {event.kind === 'completed' ? <Check size={15} /> : <Plus size={15} />}
                          </span>
                          <div className="profile-event-copy">
                            <b>{event.kind === 'completed' ? 'Completed task' : 'Created task'}</b>
                            <span>{event.task.title}</span>
                            <small>{event.task.project || 'Personal'} · {formatDate(event.date, timezone, {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}</small>
                          </div>
                        </article>
                      ))}
                    </section>
                  );
                })}
                {displayedEvents.length < yearEvents.length && (
                  <button className="profile-show-more" onClick={() => setVisibleCount((count) => count + 10)}>
                    Show more activity
                  </button>
                )}
              </div>
            ) : (
              <div className="profile-empty">
                <Activity size={22} />
                <b>No contributions in {year} yet</b>
                <span>Create or complete a task and your activity will appear here.</span>
              </div>
            )}
          </section>
        </div>
        <aside className="profile-side-column">
          <section className="profile-panel profile-about">
            <div className="profile-section-heading"><h2>About</h2><UserRound size={17} /></div>
            <p>{user.isGuest ? 'Guest access' : user.email}</p>
            <span>{user.isGuest ? 'Your demo changes are saved to this account.' : 'Member of Tasxity'}</span>
          </section>
          <section className="profile-panel profile-year-list">
            <h2>Activity year</h2>
            {Array.from({ length: 5 }, (_, index) => currentYear - index).map((activityYear) => (
              <button key={activityYear} className={year === activityYear ? 'selected' : ''}
                aria-pressed={year === activityYear} onClick={() => { setYear(activityYear); setVisibleCount(10); }}>
                {activityYear}
                <span>{events.filter((event) => event.day.startsWith(`${activityYear}-`)).length}</span>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </section>
  );
}
