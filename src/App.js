/*
  ========================================
  SMART LIBRARY MANAGEMENT SYSTEM — REACT VERSION
  ========================================

  1. DATABASE  — same localStorage logic as the original script.js
  2. COMPONENTS — each "page" is its own React component
     • LoginPage
     • SignupPage
     • Dashboard
     • BookCatalog
     • IssueReturn
     • PodBooking
     • EventsHub
     • HistoryProfile
     • AdminControls
     • Sidebar / Topbar (shared layout)
  3. APP — the root component that holds all state and renders pages
*/

import React, { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// TOAST HELPER  (tiny in-React notification)
// ─────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = "info", duration = 2500) => {
    const id = Date.now();
    setToasts(prev => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  return { toasts, show };
}

function ToastContainer({ toasts }) {
  const colors = { success: "#10b981", error: "#ef4444", warning: "#f59e0b", info: "#3b82f6" };
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: colors[t.type] || colors.info,
          color: "#fff", padding: "12px 18px", borderRadius: 8,
          fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          animation: "slideIn 0.3s ease", maxWidth: 320, fontSize: 14
        }}>{t.message}</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// DATABASE  (same logic as original script.js)
// ─────────────────────────────────────────────
const DB_KEY = "library_db";
const INIT_KEY = "library_db_initialized";

const INITIAL_DB = {
  users: [
    { id: "STU2024", name: "John Doe", email: "john.doe@university.edu", role: "student", password: "Read@2024", membership: "basic" },
    { id: "ADMIN001", name: "Admin User", email: "admin@library.edu", role: "admin", password: "Lib@2024", membership: "elite" },
    { id: "STU2025", name: "Jane Smith", email: "jane.smith@university.edu", role: "student", password: "Read@2024", membership: "plus" },
    { id: "STU2026", name: "Mike Johnson", email: "mike.johnson@university.edu", role: "student", password: "Read@2024", membership: "basic" }
  ],
  books: [
    { id: "B001", title: "Clean Code", author: "Robert C. Martin", category: "Programming", genre: "Computer Science", isbn: "978-0-13-235088-4", available: true, totalCopies: 5, issuedCopies: 2 },
    { id: "B002", title: "Design Patterns", author: "Gang of Four", category: "Programming", genre: "Computer Science", isbn: "978-0-201-63361-0", available: false, totalCopies: 3, issuedCopies: 3 },
    { id: "B003", title: "The Pragmatic Programmer", author: "David Thomas", category: "Programming", genre: "Computer Science", isbn: "978-0-20-161622-4", available: true, totalCopies: 4, issuedCopies: 1 },
    { id: "B004", title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "Programming", genre: "Computer Science", isbn: "978-0-262-03384-8", available: true, totalCopies: 2, issuedCopies: 0 },
    { id: "B005", title: "Structure and Interpretation of Computer Programs", author: "Harold Abelson", category: "Programming", genre: "Computer Science", isbn: "978-0-262-51087-5", available: true, totalCopies: 3, issuedCopies: 1 },
    { id: "B006", title: "The Art of Computer Programming", author: "Donald Knuth", category: "Programming", genre: "Computer Science", isbn: "978-0-201-89684-8", available: false, totalCopies: 2, issuedCopies: 2 },
    { id: "B007", title: "Code Complete", author: "Steve McConnell", category: "Programming", genre: "Software Engineering", isbn: "978-0-7356-1967-8", available: true, totalCopies: 4, issuedCopies: 2 },
    { id: "B008", title: "Refactoring", author: "Martin Fowler", category: "Programming", genre: "Software Engineering", isbn: "978-0-201-48567-7", available: true, totalCopies: 3, issuedCopies: 1 },
    { id: "B009", title: "Sapiens", author: "Yuval Noah Harari", category: "Non-Fiction", genre: "History", isbn: "978-0-06-231609-7", available: true, totalCopies: 4, issuedCopies: 1 },
    { id: "B010", title: "Atomic Habits", author: "James Clear", category: "Self-Help", genre: "Personal Development", isbn: "978-0-7352-1129-2", available: false, totalCopies: 4, issuedCopies: 4 },
    { id: "B011", title: "The Lean Startup", author: "Eric Ries", category: "Business", genre: "Entrepreneurship", isbn: "978-0-307-88789-4", available: true, totalCopies: 3, issuedCopies: 1 },
    { id: "B012", title: "Domain-Driven Design", author: "Eric Evans", category: "Programming", genre: "Software Architecture", isbn: "978-0-321-12521-5", available: true, totalCopies: 2, issuedCopies: 0 },
    { id: "B013", title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell", category: "Programming", genre: "Artificial Intelligence", isbn: "978-0-13-604259-7", available: true, totalCopies: 3, issuedCopies: 1 },
    { id: "B014", title: "Machine Learning Yearning", author: "Andrew Ng", category: "Programming", genre: "Machine Learning", isbn: "978-1-322-05056-0", available: true, totalCopies: 4, issuedCopies: 2 },
    { id: "B015", title: "Python Crash Course", author: "Eric Matthes", category: "Programming", genre: "Computer Science", isbn: "978-1-59327-9280-0", available: true, totalCopies: 5, issuedCopies: 2 },
    { id: "B016", title: "JavaScript: The Good Parts", author: "Douglas Crockford", category: "Programming", genre: "Web Development", isbn: "978-0-596-51774-6", available: true, totalCopies: 6, issuedCopies: 3 },
    { id: "B017", title: "You Don't Know JS", author: "Kyle Simpson", category: "Programming", genre: "Web Development", isbn: "978-1-9339-20012-0", available: true, totalCopies: 4, issuedCopies: 1 },
    { id: "B018", title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", category: "Programming", genre: "Data Science", isbn: "978-1-4493-60048-5", available: true, totalCopies: 3, issuedCopies: 1 },
    { id: "B019", title: "The Go Programming Language", author: "Alan Donovan", category: "Programming", genre: "Computer Science", isbn: "978-0-134-61006-1", available: true, totalCopies: 4, issuedCopies: 2 },
    { id: "B020", title: "Deep Learning", author: "Ian Goodfellow", category: "Programming", genre: "Machine Learning", isbn: "978-0-262-33572-3", available: false, totalCopies: 3, issuedCopies: 3 }
  ],
  issuedBooks: [
    { id: "IB001", userId: "STU2024", bookId: "B001", issueDate: "2026-02-01", dueDate: "2026-02-15", returned: false, fine: 0 },
    { id: "IB003", userId: "STU2024", bookId: "B006", issueDate: "2026-01-25", dueDate: "2026-02-08", returned: false, fine: 0 },
    { id: "IB004", userId: "STU2024", bookId: "B003", issueDate: "2026-03-01", dueDate: "2026-03-15", returned: false, fine: 0 }
  ],
  events: [
    { id: "E001", title: "Book Reading Club", date: "2026-04-15", time: "3:00 PM", location: "Library Hall A", category: "academic", capacity: 50, registered: 45, description: "Monthly book discussion meeting" },
    { id: "E002", title: "Study Skills Workshop", date: "2026-04-20", time: "2:00 PM", location: "Conference Room", category: "workshop", capacity: 40, registered: 30, description: "Learn effective study techniques" },
    { id: "E003", title: "Author Meet & Greet", date: "2026-04-25", time: "4:00 PM", location: "Main Library", category: "social", capacity: 75, registered: 60, description: "Meet local authors and discuss their work" },
    { id: "E004", title: "Research Methods Seminar", date: "2026-05-01", time: "10:00 AM", location: "Seminar Hall", category: "academic", capacity: 30, registered: 25, description: "Advanced research methodology workshop" },
    { id: "E005", title: "Creative Writing Workshop", date: "2026-05-05", time: "1:00 PM", location: "Room 201", category: "workshop", capacity: 20, registered: 15, description: "Express your creativity through writing" },
    { id: "E006", title: "Hackathon Warmup", date: "2026-05-10", time: "9:00 AM", location: "Innovation Lab", category: "workshop", capacity: 100, registered: 80, description: "Prepare for the upcoming hackathon" },
    { id: "E007", title: "AI Reading Circle", date: "2026-05-12", time: "11:00 AM", location: "Reading Room 2", category: "academic", capacity: 30, registered: 12, description: "Weekly discussion on latest AI research papers" },
    { id: "E008", title: "Resume Review Booth", date: "2026-05-15", time: "2:00 PM", location: "Career Center", category: "workshop", capacity: 50, registered: 40, description: "One-on-one resume review with industry experts" }
  ],
  seats: [
    { id: "A1", row: "A", number: 1, occupied: true, reservedBy: "STU2026" },
    { id: "A2", row: "A", number: 2, occupied: false, reservedBy: null },
    { id: "A3", row: "A", number: 3, occupied: false, reservedBy: null },
    { id: "A4", row: "A", number: 4, occupied: true, reservedBy: "STU2025" },
    { id: "A5", row: "A", number: 5, occupied: false, reservedBy: null },
    { id: "A6", row: "A", number: 6, occupied: false, reservedBy: null },
    { id: "B1", row: "B", number: 1, occupied: false, reservedBy: null },
    { id: "B2", row: "B", number: 2, occupied: false, reservedBy: null },
    { id: "B3", row: "B", number: 3, occupied: false, reservedBy: null },
    { id: "B4", row: "B", number: 4, occupied: true, reservedBy: "STU2024" },
    { id: "B5", row: "B", number: 5, occupied: true, reservedBy: "STU2025" },
    { id: "B6", row: "B", number: 6, occupied: false, reservedBy: null },
    { id: "C1", row: "C", number: 1, occupied: false, reservedBy: null },
    { id: "C2", row: "C", number: 2, occupied: true, reservedBy: "STU2026" },
    { id: "C3", row: "C", number: 3, occupied: false, reservedBy: null },
    { id: "C4", row: "C", number: 4, occupied: false, reservedBy: null },
    { id: "C5", row: "C", number: 5, occupied: false, reservedBy: null },
    { id: "C6", row: "C", number: 6, occupied: false, reservedBy: null },
    { id: "D1", row: "D", number: 1, occupied: false, reservedBy: null },
    { id: "D2", row: "D", number: 2, occupied: false, reservedBy: null },
    { id: "D3", row: "D", number: 3, occupied: false, reservedBy: null },
    { id: "D4", row: "D", number: 4, occupied: false, reservedBy: null },
    { id: "D5", row: "D", number: 5, occupied: false, reservedBy: null },
    { id: "D6", row: "D", number: 6, occupied: false, reservedBy: null }
  ],
  pcReservations: [],
  feedback: [],
  todoList: [
    { id: "T1", userId: "STU2024", task: "Complete OS assignment", time: "Today", completed: false },
    { id: "T2", userId: "STU2024", task: "Return Clean Code", time: "Tomorrow", completed: false }
  ],
  eventRegistrations: [],
  eventParticipations: [],
  eventWaitlist: []
};

// Initialize DB once
function initDB() {
  if (!localStorage.getItem(INIT_KEY)) {
    localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DB));
    localStorage.setItem(INIT_KEY, "true");
  }
}

function getDB() {
  return JSON.parse(localStorage.getItem(DB_KEY) || "{}");
}

function saveDB(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────
// THEME & CSS STYLES (injected once as <style>)
// ─────────────────────────────────────────────
const STYLES = `
  @keyframes slideIn { from{transform:translateX(60px);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes floatGlow { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.05) translate(2%,1%)} }
  @keyframes spin { to { transform: rotate(360deg); } }

  :root {
    --bg:#f4f7fb; --card:#fff; --primary:#2f74ff; --accent:#1aa67a;
    --text:#1f2a44; --muted:#6b7a99; --border:#e4eaf2;
    --shadow:0 16px 40px rgba(31,42,68,.12);
    --glass:rgba(255,255,255,.7); --blur-tint:rgba(245,248,255,.7);
  }
  .dark-theme {
    --bg:#0b111d; --card:rgba(15,22,38,.92); --primary:#8fb0ff; --accent:#40d39c;
    --text:#f3f6ff; --muted:#a8b2cf; --border:#24314d;
    --shadow:0 20px 50px rgba(0,0,0,.55);
    --glass:rgba(12,18,32,.85); --blur-tint:rgba(7,10,18,.75);
  }

  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  body { font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; min-height:100vh; transition:background .3s,color .3s; }

  .app-root { display:flex; min-height:100vh; position:relative; overflow-x:hidden; }
  .app-root::before {
    content:""; position:fixed; inset:0;
    background: radial-gradient(circle at top left, rgba(47,116,255,.2), transparent 50%),
                radial-gradient(circle at 20% 80%, rgba(26,166,122,.2), transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255,186,73,.16), transparent 45%);
    animation:floatGlow 12s ease-in-out infinite; z-index:-2;
  }
  .app-root::after {
    content:""; position:fixed; inset:0;
    backdrop-filter:blur(30px); background:var(--blur-tint); z-index:-1;
  }

  /* ─── SIDEBAR ─── */
  .sidebar {
    width:260px; flex-shrink:0; background:var(--glass); border-right:1px solid var(--border);
    padding:24px; height:100vh; position:sticky; top:0; display:flex; flex-direction:column;
    justify-content:space-between; box-shadow:var(--shadow); backdrop-filter:blur(20px) saturate(140%);
    transition:transform .35s cubic-bezier(.4,0,.2,1), width .35s, padding .35s, opacity .35s;
    overflow:hidden;
  }
  .sidebar.collapsed { transform:translateX(-100%); width:0; padding:0; min-width:0; opacity:0; pointer-events:none; }
  .brand { display:flex; gap:12px; align-items:center; }
  .brand-icon { font-size:28px; }
  .brand h1 { font-size:18px; font-weight:700; color:var(--text); }
  .brand p { font-size:12px; color:var(--muted); }
  .nav { display:flex; flex-direction:column; gap:6px; flex:1; margin-top:32px; }
  .nav-link {
    display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px;
    text-decoration:none; color:var(--muted); font-size:14px; font-weight:500;
    transition:all .2s; cursor:pointer; background:none; border:none; text-align:left; width:100%;
  }
  .nav-link:hover, .nav-link.active { background:var(--primary); color:#fff; }
  .sidebar-footer { padding-top:16px; border-top:1px solid var(--border); }
  .hint { font-size:11px; color:var(--muted); margin-top:8px; }

  /* ─── MAIN CONTENT ─── */
  .content { flex:1; min-width:0; overflow-y:auto; }
  .topbar {
    position:sticky; top:0; z-index:100; display:flex; align-items:center; gap:16px;
    padding:12px 24px; background:var(--glass); border-bottom:1px solid var(--border);
    backdrop-filter:blur(20px); box-shadow:0 2px 12px rgba(0,0,0,.06);
  }
  .icon-btn { font-size:22px; cursor:pointer; line-height:1; background:none; border:none; color:var(--text); padding:4px; }
  .hotbar { display:flex; gap:8px; flex:1; }
  .hotbar a { font-size:20px; text-decoration:none; padding:6px; border-radius:8px; transition:background .2s; }
  .hotbar a:hover { background:var(--border); }
  .hotbar-btn { font-size:20px; background:none; border:none; padding:6px; border-radius:8px; cursor:pointer; transition:background .2s; line-height:1; }
  .hotbar-btn:hover { background:var(--border); }
  .theme-selector { display:flex; gap:6px; }
  .theme-btn { font-size:18px; cursor:pointer; padding:6px; border-radius:8px; border:none; background:none; transition:background .2s; }
  .theme-btn:hover { background:var(--border); }

  /* ─── PAGE ─── */
  .page { padding:28px; animation:fadeInUp .4s ease; }
  .page-header { margin-bottom:24px; }
  .page-header h2 { font-size:26px; font-weight:700; color:var(--text); }
  .page-header p { color:var(--muted); margin-top:4px; }

  /* ─── GRID ─── */
  .grid { display:grid; gap:20px; margin-bottom:24px; }
  .grid-2 { grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); }
  .grid-3 { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .grid-4 { grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }

  /* ─── CARD ─── */
  .card {
    background:var(--card); border:1px solid var(--border); border-radius:16px;
    padding:22px; box-shadow:var(--shadow); transition:transform .2s, box-shadow .2s;
    animation:fadeInUp .4s ease;
  }
  .card:hover { transform:translateY(-3px); box-shadow:0 24px 50px rgba(31,42,68,.16); }
  .card h3 { font-size:16px; font-weight:700; margin-bottom:10px; color:var(--text); }
  .card h4 { font-size:14px; font-weight:600; margin-bottom:8px; color:var(--text); }
  .card p { font-size:14px; color:var(--muted); margin-bottom:8px; }
  .card.highlight { border-color:var(--primary); background:linear-gradient(135deg,rgba(47,116,255,.06),transparent); }
  .card.spotlight { border-color:var(--accent); background:linear-gradient(135deg,rgba(26,166,122,.08),transparent); }
  .card.warning-card { border-color:#f59e0b; background:linear-gradient(135deg,rgba(245,158,11,.07),transparent); }

  .icon { font-size:28px; display:block; margin-bottom:8px; }
  .value { font-size:32px; font-weight:800; color:var(--primary); }
  .sub { font-size:12px; color:var(--muted); }

  /* ─── FORM ─── */
  .form { display:flex; flex-direction:column; gap:14px; }
  .form label { display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:600; color:var(--text); }
  .form input, .form select, .form textarea {
    padding:10px 14px; border:1.5px solid var(--border); border-radius:10px;
    background:var(--bg); color:var(--text); font-size:14px;
    transition:border-color .2s, box-shadow .2s; outline:none;
  }
  .form input:focus, .form select:focus, .form textarea:focus {
    border-color:var(--primary); box-shadow:0 0 0 3px rgba(47,116,255,.12);
  }
  .form textarea { resize:vertical; min-height:80px; }

  /* ─── BUTTONS ─── */
  .btn {
    padding:10px 20px; border-radius:10px; font-size:14px; font-weight:600;
    cursor:pointer; border:none; transition:all .2s; display:inline-flex; align-items:center; gap:6px;
  }
  .btn:disabled { opacity:.55; cursor:not-allowed; }
  .btn.primary { background:var(--primary); color:#fff; }
  .btn.primary:hover:not(:disabled) { background:#1a60e8; transform:translateY(-1px); }
  .btn.accent { background:var(--accent); color:#fff; }
  .btn.accent:hover:not(:disabled) { background:#148c67; transform:translateY(-1px); }
  .btn.ghost { background:transparent; color:var(--primary); border:1.5px solid var(--primary); }
  .btn.ghost:hover:not(:disabled) { background:var(--primary); color:#fff; }
  .btn.danger { background:#ef4444; color:#fff; }
  .btn.danger:hover:not(:disabled) { background:#dc2626; }
  .btn.success { background:#10b981; color:#fff; }
  .btn.sm { padding:6px 12px; font-size:12px; }
  .btn.full { width:100%; justify-content:center; margin-top:6px; }

  /* ─── LIST ─── */
  .list { list-style:none; display:flex; flex-direction:column; gap:10px; }
  .list li { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border); font-size:14px; }
  .list li:last-child { border-bottom:none; }
  .list li span { color:var(--muted); font-size:12px; }

  /* ─── PILLS ─── */
  .pill-list { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .pill {
    background:var(--border); color:var(--text); padding:5px 12px; border-radius:20px;
    font-size:12px; font-weight:500; text-decoration:none; transition:background .2s;
  }
  a.pill:hover { background:var(--primary); color:#fff; }

  /* ─── MEMBERSHIP ─── */
  .membership { display:flex; gap:10px; margin:12px 0; }
  .membership-tier { flex:1; padding:12px; border:1.5px solid var(--border); border-radius:12px; text-align:center; }
  .membership-tier strong { display:block; font-size:14px; color:var(--text); }
  .membership-tier span { display:block; font-size:12px; color:var(--primary); font-weight:600; margin-top:4px; }
  .membership-tier p { font-size:11px; color:var(--muted); margin-top:4px; }
  .membership-tier.highlight { border-color:var(--primary); background:rgba(47,116,255,.06); }

  /* ─── STREAK BAR ─── */
  .streak-bar { display:flex; gap:6px; margin-top:10px; }
  .streak-bar span { flex:1; text-align:center; padding:6px; border-radius:8px; background:var(--primary); color:#fff; font-size:12px; font-weight:600; }

  /* ─── SEAT GRID ─── */
  .seat-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin:16px 0; }
  .seat {
    padding:8px; border-radius:8px; text-align:center; font-size:12px; font-weight:600;
    cursor:pointer; border:2px solid transparent; transition:all .15s; user-select:none;
  }
  .seat.available { background:rgba(26,166,122,.12); color:var(--accent); border-color:var(--accent); }
  .seat.available:hover { background:var(--accent); color:#fff; }
  .seat.selected { background:var(--primary); color:#fff; border-color:var(--primary); }
  .seat.booked { background:rgba(239,68,68,.12); color:#ef4444; border-color:#ef4444; cursor:not-allowed; }

  /* ─── BOOK CARD ─── */
  .book-card { position:relative; overflow:hidden; }
  .book-cover { height:160px; border-radius:10px 10px 0 0; overflow:hidden; margin:-22px -22px 16px; position:relative; }
  .book-cover img { width:100%; height:100%; object-fit:cover; }
  .book-badge {
    position:absolute; top:12px; right:12px; padding:3px 8px; border-radius:6px;
    font-size:11px; font-weight:600; color:#fff;
  }
  .book-badge.issued { background:#ef4444; }
  .book-badge.yours { background:#10b981; }
  .book-status { font-size:13px; font-weight:600; margin:8px 0; }
  .book-status.available { color:var(--accent); }
  .book-status.unavailable { color:#ef4444; }

  /* ─── EVENT CARD ─── */
  .event-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
  .event-category { padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; background:var(--border); color:var(--muted); }
  .event-category.academic { background:rgba(47,116,255,.12); color:var(--primary); }
  .event-category.workshop { background:rgba(26,166,122,.12); color:var(--accent); }
  .event-category.social { background:rgba(245,158,11,.12); color:#f59e0b; }
  .event-details p { font-size:13px; margin-bottom:4px; }
  .event-actions { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }

  /* ─── ADMIN ACTIONS ─── */
  .admin-actions { display:flex; flex-direction:column; gap:10px; margin-top:10px; }

  /* ─── SEARCH GRID ─── */
  .search-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin-bottom:16px; }

  /* ─── GENRE PANEL ─── */
  .genre-panel { margin-bottom:20px; }

  /* ─── OVERDUE ─── */
  .fine-badge { color:#ef4444; font-weight:700; font-size:13px; }
  .overdue-info { background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.2); border-radius:8px; padding:10px 14px; margin-top:8px; }

  /* ─── LOADING ─── */
  .loading-overlay {
    position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center;
    background:rgba(11,17,29,.92); backdrop-filter:blur(10px);
  }
  .loading-content { text-align:center; color:#fff; }
  .loading-spinner {
    width:48px; height:48px; border:4px solid rgba(255,255,255,.2);
    border-top-color:var(--primary); border-radius:50%; animation:spin .8s linear infinite; margin:20px auto 0;
  }

  /* ─── LOGIN PAGE ─── */
  .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .login-shell { width:100%; max-width:960px; }
  .login-shell-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; }
  .login-brand { font-size:24px; font-weight:700; }
  .logo-soft { color:var(--muted); font-weight:400; }
  .login-metrics { display:flex; gap:16px; margin-top:16px; }
  .login-metrics div { text-align:center; }
  .login-metrics strong { display:block; font-size:18px; font-weight:800; color:var(--primary); }
  .login-metrics span { font-size:11px; color:var(--muted); }
  .login-visual img { width:100%; border-radius:10px; margin:10px 0; }
  .admin-permissions ul { list-style:disc; padding-left:16px; margin-top:8px; }
  .admin-permissions li { font-size:12px; color:var(--muted); margin-bottom:4px; }
  .signup-visual { width:100%; border-radius:10px; margin-top:10px; }

  /* ─── RESPONSIVE ─── */
  @media(max-width:768px) {
    .sidebar { position:fixed; z-index:500; }
    .sidebar.collapsed { transform:translateX(-100%); }
    .grid-4 { grid-template-columns:repeat(2,1fr); }
  }

  /* ─── SCROLLBAR ─── */
  ::-webkit-scrollbar { width:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }

  /* ─── PROFILE BADGES ─── */
  .badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; }
  .badge.basic { background:rgba(107,122,153,.15); color:var(--muted); }
  .badge.plus { background:rgba(47,116,255,.12); color:var(--primary); }
  .badge.elite { background:rgba(26,166,122,.12); color:var(--accent); }
  .badge.active { background:rgba(16,185,129,.12); color:#10b981; }
`;

// ─────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────
function LoginPage({ onLogin, onGoSignup, onNotify }) {
  const [studentId, setStudentId] = useState("");
  const [studentPwd, setStudentPwd] = useState("");
  const [adminId, setAdminId] = useState("");
  const [adminPwd, setAdminPwd] = useState("");

  // SVG inline for access hub illustration (same as original)
  const accessHubSvg = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27900%27%20height%3D%27600%27%20viewBox%3D%270%200%20900%20600%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27bg%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%271%27%20y2%3D%271%27%3E%3Cstop%20stop-color%3D%27%230d1a35%27/%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%232d5ca8%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%27900%27%20height%3D%27600%27%20fill%3D%27url(%23bg)%27/%3E%3Crect%20x%3D%2750%27%20y%3D%2780%27%20width%3D%27310%27%20height%3D%27440%27%20rx%3D%2718%27%20fill%3D%27%23172d56%27/%3E%3Crect%20x%3D%27390%27%20y%3D%2780%27%20width%3D%27460%27%20height%3D%27440%27%20rx%3D%2722%27%20fill%3D%27%23f4f8ff%27%20opacity%3D%270.92%27/%3E%3Ccircle%20cx%3D%27580%27%20cy%3D%27225%27%20r%3D%2760%27%20fill%3D%27%23e4b08e%27/%3E%3Crect%20x%3D%27508%27%20y%3D%27288%27%20width%3D%27145%27%20height%3D%27165%27%20rx%3D%2745%27%20fill%3D%27%23203967%27/%3E%3Crect%20x%3D%27486%27%20y%3D%27335%27%20width%3D%27188%27%20height%3D%27100%27%20rx%3D%2738%27%20fill%3D%27%23284578%27/%3E%3Cpath%20d%3D%27M544%20203%20q35-50%2090-20%27%20stroke%3D%27%231a2f58%27%20stroke-width%3D%2714%27%20fill%3D%27none%27%20stroke-linecap%3D%27round%27/%3E%3Crect%20x%3D%27452%27%20y%3D%27462%27%20width%3D%27265%27%20height%3D%2722%27%20rx%3D%2711%27%20fill%3D%27%232f74ff%27/%3E%3Crect%20x%3D%27445%27%20y%3D%27492%27%20width%3D%27210%27%20height%3D%2719%27%20rx%3D%279.5%27%20fill%3D%27%231aa67a%27/%3E%3Ctext%20x%3D%27205%27%20y%3D%27185%27%20font-size%3D%2738%27%20text-anchor%3D%27middle%27%20fill%3D%27%23c6d9ff%27%20font-family%3D%27Segoe%20UI%2CArial%27%3ESmart%20library%3C/text%3E%3Ctext%20x%3D%27205%27%20y%3D%27250%27%20font-size%3D%2722%27%20text-anchor%3D%27middle%27%20fill%3D%27%2397b2ea%27%20font-family%3D%27Segoe%20UI%2CArial%27%3ELibrary%20Portal%3C/text%3E%3Crect%20x%3D%2795%27%20y%3D%27320%27%20width%3D%27220%27%20height%3D%2738%27%20rx%3D%2714%27%20fill%3D%27%232f74ff%27%20opacity%3D%270.8%27/%3E%3Crect%20x%3D%2795%27%20y%3D%27370%27%20width%3D%27175%27%20height%3D%2738%27%20rx%3D%2714%27%20fill%3D%27%231aa67a%27%20opacity%3D%270.85%27/%3E%3C/svg%3E`;

  function handleStudent(e) {
    e.preventDefault();
    
    // Validation checks
    if (!studentId.trim()) {
      onNotify("Please enter your Student ID", "error");
      return;
    }
    if (!studentPwd.trim()) {
      onNotify("Please enter your password", "error");
      return;
    }
    
    const db = getDB();
    const user = db.users?.find(u => u.id === studentId && u.password === studentPwd && u.role === "student");
    
    if (user) {
      onLogin("student", user);
      onNotify(`Welcome, ${user.name}! ✅`, "success");
    } else {
      // Check if ID exists but password is wrong
      const idExists = db.users?.find(u => u.id === studentId && u.role === "student");
      if (idExists) {
        onNotify("Incorrect password. Please try again.", "error");
      } else {
        onNotify("Student ID not found. Please check and try again.", "error");
      }
    }
  }

  function handleAdmin(e) {
    e.preventDefault();
    
    // Validation checks
    if (!adminId.trim()) {
      onNotify("Please enter your Admin ID", "error");
      return;
    }
    if (!adminPwd.trim()) {
      onNotify("Please enter your password", "error");
      return;
    }
    
    const db = getDB();
    const user = db.users?.find(u => u.id === adminId && u.password === adminPwd && u.role === "admin");
    
    if (user) {
      onLogin("admin", user);
      const adminMsg = "Welcome, Admin " + user.name + "! ✅";
      onNotify(adminMsg, "success");
    } else {
      // Check if ID exists but password is wrong
      const idExists = db.users?.find(u => u.id === adminId && u.role === "admin");
      if (idExists) {
        onNotify("Incorrect password. Please try again.", "error");
      } else {
        onNotify("Admin ID not found. Please check and try again.", "error");
      }
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-shell-top">
          <div className="login-brand"><span className="logo-soft">Smart</span><strong>Library</strong> 📚</div>
          <button className="btn ghost" onClick={onGoSignup}>Sign Up</button>
        </div>

        <div className="grid grid-2" style={{ marginBottom: 20 }}>
          {/* Left section */}
          <div>
            <div className="page-header">
              <h2>Welcome Back 👋</h2>
              <p>Log in to unlock your personalized library experience.</p>
            </div>
            <div className="grid grid-2">
              <div className="card">
                <h3>Student Login</h3>
                <p>Access your issued books, due dates, and history.</p>
                <p className="sub" style={{ marginBottom: 12 }}>Demo: <strong>STU2024</strong> / <strong>Read@2024</strong></p>
                <form className="form" onSubmit={handleStudent}>
                  <label>Student ID <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Enter Student ID" /></label>
                  <label>Password <input type="password" value={studentPwd} onChange={e => setStudentPwd(e.target.value)} placeholder="Enter Password" /></label>
                  <button className="btn primary" type="submit">Login as Student</button>
                </form>
              </div>

              <div className="card highlight">
                <h3>Admin Login</h3>
                <p>Manage fines, book status, and issue approvals.</p>
                <p className="sub" style={{ marginBottom: 12 }}>Demo: <strong>ADMIN001</strong> / <strong>Lib@2024</strong></p>
                <form className="form" onSubmit={handleAdmin}>
                  <label>Admin ID <input value={adminId} onChange={e => setAdminId(e.target.value)} placeholder="Enter Admin ID" /></label>
                  <label>Password <input type="password" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} placeholder="Enter Password" /></label>
                  <button className="btn accent" type="submit">Login as Admin</button>
                </form>
                <div className="admin-permissions" style={{ marginTop: 14 }}>
                  <h4>Admin Special Permissions</h4>
                  <ul><li>Add or waive fines</li><li>Mark book as lost/damaged</li><li>Override due dates</li><li>Approve manual issue/return</li></ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right: visual + metrics */}
          <div className="card login-visual">
            <h3>Smart Library Access Hub</h3>
            <p>One clean space for students and admins to manage everything in the library.</p>
            <img src={accessHubSvg} alt="Smart Library portal illustration" style={{ width: "100%", borderRadius: 10, margin: "10px 0" }} />
            <div className="pill-list">
              <span className="pill">📚 Catalog Search</span>
              <span className="pill">🧾 Issue / Return</span>
              <span className="pill">💳 Fine Payment</span>
            </div>
            <div className="login-metrics">
              <div><strong>20+</strong><span>Book Categories</span></div>
              <div><strong>24/7</strong><span>Portal Access</span></div>
              <div><strong>2 Min</strong><span>Quick Issue Flow</span></div>
            </div>
          </div>
        </div>

        <div className="card spotlight">
          <h3>Why students love this portal ❤️</h3>
          <ul className="list">
            <li>Smart reminders for due dates <span>Never miss a deadline</span></li>
            <li>One-tap issue requests <span>Faster than the queue</span></li>
            <li>Premium reading mood <span>Light/dark themes</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SIGNUP PAGE
// ─────────────────────────────────────────────
function SignupPage({ onBack, onNotify }) {
  const [form, setForm] = useState({ name: "", email: "", studentId: "", password: "" });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email) { onNotify("Please fill in all fields", "error"); return; }
    onNotify("Account created! You can now login.", "success");
    setTimeout(onBack, 1500);
  }

  const signupSvg = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27900%27%20height%3D%27600%27%20viewBox%3D%270%200%20900%20600%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27bg%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%271%27%20y2%3D%271%27%3E%3Cstop%20stop-color%3D%27%230f2143%27/%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23356ec5%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%27900%27%20height%3D%27600%27%20fill%3D%27url(%23bg)%27/%3E%3Crect%20x%3D%2758%27%20y%3D%2772%27%20width%3D%27784%27%20height%3D%27458%27%20rx%3D%2724%27%20fill%3D%27%23ffffff%27%20opacity%3D%270.9%27/%3E%3Ccircle%20cx%3D%27275%27%20cy%3D%27220%27%20r%3D%2768%27%20fill%3D%27%23e8b290%27/%3E%3Crect%20x%3D%27192%27%20y%3D%27288%27%20width%3D%27166%27%20height%3D%27172%27%20rx%3D%2748%27%20fill%3D%27%23213f74%27/%3E%3Crect%20x%3D%27178%27%20y%3D%27338%27%20width%3D%27195%27%20height%3D%2790%27%20rx%3D%2738%27%20fill%3D%27%232b4d88%27/%3E%3Cpath%20d%3D%27M228%20204%20q44-46%2098-10%27%20stroke%3D%27%23192f59%27%20stroke-width%3D%2714%27%20stroke-linecap%3D%27round%27%20fill%3D%27none%27/%3E%3Ctext%20x%3D%27490%27%20y%3D%27425%27%20font-size%3D%2736%27%20fill%3D%27%23213963%27%20font-family%3D%27Segoe%20UI%2CArial%27%3EWelcome%20to%20Smart%20library%3C/text%3E%3C/svg%3E`;

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-shell-top">
          <div className="login-brand"><span className="logo-soft">Smart</span><strong>Library</strong> 📚</div>
          <button className="btn ghost" onClick={onBack}>Back to Login</button>
        </div>
        <div className="grid grid-2">
          <div className="card">
            <h3>Create Student Account</h3>
            <form className="form" onSubmit={handleSubmit}>
              <label>Full Name <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Aarav Mehta" /></label>
              <label>Email <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="student@college.edu" /></label>
              <label>Student ID <input value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} placeholder="STU2025" /></label>
              <label>Password <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create password" /></label>
              <button className="btn primary" type="submit">Create Account</button>
            </form>
          </div>
          <div className="card highlight">
            <h3>Why Sign Up?</h3>
            <ul className="list">
              <li>Book issue & return tracking <span>Realtime status</span></li>
              <li>Overdue payment alerts <span>Never miss deadlines</span></li>
              <li>Premium dashboard insights <span>Study smarter</span></li>
            </ul>
            <img src={signupSvg} className="signup-visual" alt="Signup illustration" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function Dashboard({ user, onNotify }) {
  // Store DB data in state so it re-renders correctly when the page is visited
  const [myIssues, setMyIssues] = useState([]);
  const [totalBooks, setTotalBooks] = useState(0);

  useEffect(() => {
    const db = getDB();
    setMyIssues(db.issuedBooks?.filter(i => i.userId === user?.id && !i.returned) || []);
    setTotalBooks(db.books?.length || 0);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dashboard Overview</h2>
        <p>Quick glance at your library activity and reminders.</p>
      </div>

      <div className="grid grid-4">
        <div className="card"><span className="icon">📘</span><h3>Total Books</h3><p className="value">{totalBooks}</p></div>
        <div className="card"><span className="icon">✅</span><h3>Books Issued</h3><p className="value">{myIssues.length}</p></div>
        <div className="card"><span className="icon">⏰</span><h3>Due Reminder</h3><p className="value">2 days left</p><p className="sub">Return "Clean Code" by 12 Oct</p></div>
        <div className="card"><span className="icon">🆕</span><h3>Recently Issued</h3><p className="sub">Design Patterns, AI Basics</p></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Upcoming Returns</h3>
          <ul className="list">
            <li>Clean Code <span>12 Oct</span></li>
            <li>Data Structures <span>18 Oct</span></li>
          </ul>
        </div>
        <div className="card">
          <h3>Announcements</h3>
          <p>📣 Library will be open until 8 PM during exam week.</p>
          <p>✨ New arrivals in AI &amp; ML section.</p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card spotlight"><h3>Innovation: Smart Shelf Radar</h3><p>Shows trending shelves so you discover popular books first.</p></div>
        <div className="card spotlight"><h3>Innovation: Focus Mode</h3><p>One-tap distraction-free reading recommendations.</p></div>
        <div className="card spotlight"><h3>Innovation: Study Buddy Picks</h3><p>Suggested books based on your course and semester.</p></div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Quiet Zone Heatmap</h3>
          <p>Find peaceful seats based on live noise trends (demo).</p>
          <div className="pill-list">
            <span className="pill">Block A: Silent ✅</span>
            <span className="pill">Block B: Low chatter 💤</span>
            <span className="pill">Block C: Group study 🎧</span>
            <span className="pill">Block D: Active zone ⚡</span>
          </div>
        </div>
        <div className="card">
          <h3>Smart Locker Pickup</h3>
          <p>Reserve a book and collect it from 24/7 smart lockers.</p>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => onNotify("Locker reserved! Collect at your convenience 🔐", "success")}>Reserve Locker</button>
        </div>
        <div className="card">
          <h3>Reading Streaks</h3>
          <p>🔥 You're on a 5-day streak. Keep it alive!</p>
          <div className="streak-bar"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Membership Options</h3>
          <p>Upgrade for premium perks and extended access.</p>
          <div className="membership">
            <div className="membership-tier"><strong>Basic</strong><span>Free</span><p>2 books, 7-day issue</p></div>
            <div className="membership-tier highlight"><strong>Plus</strong><span>₹199 / semester</span><p>5 books, 14-day issue</p></div>
            <div className="membership-tier"><strong>Elite</strong><span>₹349 / semester</span><p>8 books, priority rooms</p></div>
          </div>
          <button className="btn ghost full" onClick={() => onNotify("Membership upgrade in progress! 🚀", "success")}>Upgrade Membership</button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Feedback Lounge</h3>
          <p>Tell us what you love or what we can improve.</p>
          <div className="form">
            <label>Rate the experience
              <select><option>⭐⭐⭐⭐⭐ Amazing</option><option>⭐⭐⭐⭐ Great</option><option>⭐⭐⭐ Good</option><option>⭐⭐ Needs work</option></select>
            </label>
            <label>Your feedback <textarea rows={3} placeholder="Share your thoughts..." /></label>
            <button className="btn primary" onClick={() => onNotify("Thank you for your feedback! We appreciate it 💝", "success")}>Send Feedback</button>
          </div>
        </div>
        <div className="card">
          <h3>Fun Corner 🎉</h3>
          <p>Quick boosts to keep you motivated.</p>
          <ul className="list">
            <li>Daily quiz <span>Win badges</span></li>
            <li>Reading mood picker <span>Calm / Energetic</span></li>
            <li>Book swap wall <span>Trade with peers</span></li>
          </ul>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => onNotify("Welcome to the Fun Corner! 🎉 Your first quiz awaits!", "success")}>Join Today</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BOOK CATALOG
// ─────────────────────────────────────────────
function BookCatalog({ user, onNotify }) {
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("All");
  const [books, setBooks] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0); // bump this to force a re-filter after mutations

  // This is the single function that filters and sets books.
  // It takes values as arguments so it always works with fresh data,
  // avoiding the stale-state closure problem.
  function applyFilters(s, a, c, av) {
    const db = getDB();
    let list = db.books || [];
    if (s) list = list.filter(b => b.title.toLowerCase().includes(s.toLowerCase()) || b.author.toLowerCase().includes(s.toLowerCase()));
    if (a) list = list.filter(b => b.author.toLowerCase().includes(a.toLowerCase()));
    if (c) list = list.filter(b => b.genre?.toLowerCase().includes(c.toLowerCase()) || b.category?.toLowerCase().includes(c.toLowerCase()));
    if (av !== "All") list = list.filter(b => b.available === (av === "Available"));
    setBooks(list);
  }

  // Re-runs whenever any filter changes OR after a mutation (refreshKey bump)
  useEffect(() => {
    applyFilters(search, author, category, availability);
  }, [search, author, category, availability, refreshKey]);

  function issueBook(bookId) {
    if (!user) { onNotify("Please login to issue books", "error"); return; }
    const db = getDB();
    const book = db.books.find(b => b.id === bookId);
    if (!book || !book.available) { onNotify("Book not available", "error"); return; }
    const alreadyIssued = db.issuedBooks?.some(i => i.bookId === bookId && i.userId === user.id && !i.returned);
    if (alreadyIssued) { onNotify("You already have this book issued", "warning"); return; }
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    db.issuedBooks.push({ id: "IB" + Date.now(), userId: user.id, bookId, issueDate: new Date().toISOString().split("T")[0], dueDate, returned: false, fine: 0 });
    const idx = db.books.findIndex(b => b.id === bookId);
    db.books[idx].issuedCopies++;
    db.books[idx].available = db.books[idx].issuedCopies < db.books[idx].totalCopies;
    saveDB(db);
    onNotify("Book issued! Return due in 14 days ✅", "success");
    // Bump refreshKey to trigger the useEffect to re-run applyFilters with fresh DB data.
    // This avoids stale closures entirely — the effect reads fresh state on its own.
    setRefreshKey(k => k + 1);
  }

  function reserveBook() { onNotify("Book reserved! You will be notified when available.", "success"); }

  // Reads fresh from DB every call — safe here because it's inside render, not a stale closure
  const isIssuedToUser = (bookId) => {
    const db = getDB();
    return db.issuedBooks?.some(i => i.bookId === bookId && i.userId === user?.id && !i.returned);
  };

  return (
    <div className="page">
      <div className="page-header"><h2>Book Catalog</h2><p>Search by name, author, category, or availability.</p></div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="search-grid">
          {/* onChange keeps state in sync; useEffect above fires applyFilters automatically */}
          <label className="form">Book Name
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title" />
          </label>
          <label className="form">Author
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Search by author" />
          </label>
          <label className="form">Category
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="CS, Fiction, History" />
          </label>
          <label className="form">Availability
            <select value={availability} onChange={e => setAvailability(e.target.value)}>
              <option>All</option><option>Available</option><option>Issued</option>
            </select>
          </label>
        </div>
        <button className="btn primary" onClick={() => applyFilters(search, author, category, availability)}>Smart Search 🔍</button>
      </div>

      <div className="card genre-panel">
        <h3>Popular Genres</h3>
        <div className="pill-list">
          {["Computer Science","Artificial Intelligence","Business","Design","Fiction","History","Psychology","Renewable Energy","Biographies","Self-Help","Finance","Philosophy"].map(g => (
            // Set category state — useEffect will fire applyFilters automatically
            <span key={g} className="pill" style={{ cursor: "pointer" }} onClick={() => setCategory(g)}>{g}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {books.map(book => {
          const myBook = isIssuedToUser(book.id);
          const avail = book.totalCopies - book.issuedCopies;
          return (
            <div key={book.id} className="card book-card">
              <div className="book-cover">
                <img src={`https://picsum.photos/seed/${book.title.replace(/\s+/g, "")}/400/160`} alt={book.title} onError={e => { e.target.src = `https://picsum.photos/seed/${book.id}/400/160`; }} />
                {myBook && <span className="book-badge yours">Your Book</span>}
                {!book.available && <span className="book-badge issued">All Issued</span>}
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>{book.title}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>by {book.author}</p>
              <p style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>{book.genre}</p>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>{book.category}</p>
              <p style={{ fontSize: 11, color: "var(--muted)" }}>ISBN: {book.isbn}</p>
              <p className={`book-status ${book.available ? "available" : "unavailable"}`}>
                {book.available ? `${avail} of ${book.totalCopies} available` : "All copies issued"}
              </p>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {myBook ? (
                  <button className="btn success sm" disabled>Issued to You</button>
                ) : book.available ? (
                  <button className="btn primary sm" onClick={() => issueBook(book.id)}>Issue Book</button>
                ) : (
                  <button className="btn ghost sm" onClick={reserveBook}>Reserve</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Popular Books Tab</h3>
          <p className="sub">Most issued this week in Smart library.</p>
          <ul className="list">
            <li>Clean Code <span>126 issues</span></li>
            <li>Atomic Habits <span>112 issues</span></li>
            <li>Design Patterns <span>95 issues</span></li>
            <li>Deep Work <span>83 issues</span></li>
          </ul>
        </div>
        <div className="card highlight">
          <h3>Recommendations Tab</h3>
          <p className="sub">Tailored suggestions based on your recent reads.</p>
          <ul className="list">
            <li>Refactoring <span>Because you liked Clean Code</span></li>
            <li>Cracking the PM Interview <span>Career prep</span></li>
            <li>Thinking, Fast and Slow <span>Behavioral insights</span></li>
            <li>Hands-On ML <span>AI track continuation</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ISSUE / RETURN
// ─────────────────────────────────────────────
function IssueReturn({ user, userRole, onNotify }) {
  const [issuedBooks, setIssuedBooks] = useState([]);

  // loadIssued is defined as a standalone function so it can be called
  // both from useEffect and from inside processReturn/payFine after mutations
  function loadIssued() {
    if (!user) return;
    const db = getDB();
    const issues = db.issuedBooks?.filter(i => i.userId === user.id && !i.returned) || [];
    setIssuedBooks(issues);
  }

  useEffect(() => {
    loadIssued();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // depend on user.id (a primitive) to avoid re-running on object identity changes

  function processReturn(issueId) {
    const db = getDB();
    const idx = db.issuedBooks.findIndex(i => i.id === issueId);
    if (idx === -1) { onNotify("Issue record not found", "error"); return; }
    const issue = db.issuedBooks[idx];
    const dueDate = new Date(issue.dueDate);
    const now = new Date();
    let fine = 0;
    if (now > dueDate) fine = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)) * 2;
    issue.returned = true;
    issue.returnDate = now.toISOString().split("T")[0];
    issue.fine = fine;
    const bookIdx = db.books.findIndex(b => b.id === issue.bookId);
    if (bookIdx !== -1) {
      db.books[bookIdx].issuedCopies = Math.max(0, db.books[bookIdx].issuedCopies - 1);
      db.books[bookIdx].available = db.books[bookIdx].issuedCopies < db.books[bookIdx].totalCopies;
    }
    saveDB(db);
    if (fine > 0) onNotify(`Book returned! Fine: $${fine}. Please pay the fine.`, "warning");
    else onNotify("Book returned successfully! ✅", "success");
    loadIssued();
  }

  function payFine(issueId) {
    const db = getDB();
    const idx = db.issuedBooks.findIndex(i => i.id === issueId);
    if (idx !== -1) { db.issuedBooks[idx].finePaid = true; db.issuedBooks[idx].fine = 0; saveDB(db); }
    onNotify("Fine paid successfully! ✅", "success");
    loadIssued();
  }

  function getBook(bookId) { return getDB().books?.find(b => b.id === bookId); }
  function isOverdue(dueDate) { return new Date(dueDate) < new Date(); }
  function calcFine(dueDate) { if (!isOverdue(dueDate)) return 0; return Math.ceil((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24)) * 2; }

  return (
    <div className="page">
      <div className="page-header"><h2>Issue / Return Books</h2><p>Track your issued books and return them on time.</p></div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Your Issued Books ({issuedBooks.length})</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Books currently issued to your account. Click "Return Book" to return any book.
        </p>
        {issuedBooks.length === 0 && <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No books currently issued.</p>}
      </div>

      {issuedBooks.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: 24 }}>
          {issuedBooks.map(issue => {
            const book = getBook(issue.bookId);
            const overdue = isOverdue(issue.dueDate);
            const fine = calcFine(issue.dueDate);
            if (!book) return null;
            return (
              <div key={issue.id} className={`card ${overdue ? "warning-card" : ""}`}>
                <h3>{book.title}</h3>
                <p style={{ fontSize: 13 }}><strong>Author:</strong> {book.author}</p>
                <p style={{ fontSize: 13 }}><strong>ISBN:</strong> {book.isbn}</p>
                <p style={{ fontSize: 13 }}><strong>Issue Date:</strong> {formatDate(issue.issueDate)}</p>
                <p style={{ fontSize: 13 }}><strong>Due Date:</strong> {formatDate(issue.dueDate)}</p>
                {overdue && <div className="overdue-info"><p className="fine-badge">FINE: ${fine}.00</p><p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Overdue — please return ASAP</p></div>}
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <button className="btn primary sm" onClick={() => processReturn(issue.id)}>↩ Return Book</button>
                  {fine > 0 && <button className="btn accent sm" onClick={() => payFine(issue.id)}>💳 Pay ${fine}.00</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {userRole === "student" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Pay Overdue Fine</h3>
          <p className="sub">This section is only available on Issue / Return for pending fines.</p>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <ul className="list">
              <li>Book <span>Algorithms Unlocked</span></li>
              <li>Overdue Days <span>4 days</span></li>
              <li>Base Fine <span>₹100</span></li>
              <li>Service Fee <span>₹20</span></li>
              <li><strong>Total</strong><strong>₹120</strong></li>
            </ul>
            <div className="form">
              <label>UPI ID <input placeholder="student@upi" /></label>
              <label>Card Last 4 Digits <input maxLength={4} placeholder="1234" /></label>
              <label>Confirmation <input placeholder="Type PAID" /></label>
              <button className="btn primary">Pay ₹120 Now</button>
            </div>
          </div>
        </div>
      )}

      {userRole === "admin" && (
        <div className="card">
          <h3>Admin Issue Desk</h3>
          <p>Quick view of the most recent admin-managed issues.</p>
          <ul className="list" style={{ marginTop: 10 }}>
            {issuedBooks.slice(0, 5).map(i => {
              const b = getBook(i.bookId);
              return b ? <li key={i.id}>{b.title} <span>{i.userId} • Due {formatDate(i.dueDate)}</span></li> : null;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// POD BOOKING
// ─────────────────────────────────────────────
function PodBooking({ user, userRole, onNotify }) {
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [seatCount, setSeatCount] = useState(1);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("09:00 - 10:00");
  const [zone, setZone] = useState("Silent Pod Zone");
  const [pcZone, setPcZone] = useState("Design Lab");
  const [pcDuration, setPcDuration] = useState("30 minutes");
  const [history, setHistory] = useState({ seats: [], pcs: [] });
  const [refreshKey, setRefreshKey] = useState(0);

  function loadSeats() {
    const db = getDB();
    setSeats(db.seats || []);
    const userSeatBookings = (db.seats || []).filter(s => s.reservedBy === user?.id);
    const userPCReservations = (db.pcReservations || []).filter(p => p.userId === user?.id);
    setHistory({ seats: userSeatBookings, pcs: userPCReservations });
  }

  useEffect(() => { loadSeats(); }, [user?.id, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSeat(seatId) {
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(prev => prev.filter(s => s !== seatId));
    } else {
      if (selectedSeats.length >= seatCount) {
        onNotify(`You can only select ${seatCount} seat(s)`, "warning"); return;
      }
      setSelectedSeats(prev => [...prev, seatId]);
    }
  }

  function unbookSeat(seatId) {
    const db = getDB();
    const idx = db.seats.findIndex(s => s.id === seatId);
    if (idx !== -1) {
      const bookedByUser = db.seats[idx].reservedBy;
      db.seats[idx].occupied = false;
      db.seats[idx].reservedBy = null;
      saveDB(db);
      onNotify(`Seat ${seatId} unbooked successfully! 🛑`, "success");
      setRefreshKey(k => k + 1);
    }
  }

  function bookSeats() {
    if (selectedSeats.length === 0) { onNotify("Please select at least one seat", "warning"); return; }
    if (!date) { onNotify("Please select a date", "warning"); return; }
    const db = getDB();
    selectedSeats.forEach(seatId => {
      const idx = db.seats.findIndex(s => s.id === seatId);
      if (idx !== -1) { db.seats[idx].occupied = true; db.seats[idx].reservedBy = user.id; }
    });
    saveDB(db);
    onNotify(`Booked successfully! ✅`, "success");
    setSelectedSeats([]);
    setRefreshKey(k => k + 1);
  }

  function reservePC() {
    const db = getDB();
    if (!db.pcReservations) db.pcReservations = [];
    db.pcReservations.push({ id: "PCR" + Date.now(), userId: user.id, pcNumber: pcZone, timeSlot: timeSlot, date: date || new Date().toISOString().split("T")[0], status: "active" });
    saveDB(db);
    onNotify("PC reserved successfully! ✅", "success");
    loadSeats();
  }

  const rows = ["A", "B", "C", "D"];

  return (
    <div className="page">
      <div className="page-header"><h2>Pod Seat Booking</h2><p>Choose your preferred pod seat and study slot in the Smart library.</p></div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Private Study Room Booking</h3>
          <p>Pick a room size, whiteboard, and extra equipment.</p>
          <div className="form">
            <label>Room Size <select><option>Solo Pod (1)</option><option>Focus Room (2-3)</option><option>Team Room (4-6)</option><option>Studio Room (8-10)</option></select></label>
            <label>Equipment <select><option>Whiteboard + Markers</option><option>Whiteboard + Projector</option><option>VR/Media Kit</option><option>Dual Monitor Dock</option></select></label>
            <label>Time Slot <input type="time" /></label>
            <button className="btn primary" onClick={() => onNotify("Booked successfully! ✅", "success")}>Open Pod Booking</button>
          </div>
        </div>

        <div className="card">
          <h3>Booking Details</h3>
          <div className="form">
            <label>Date <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label>Time Slot <select value={timeSlot} onChange={e => setTimeSlot(e.target.value)}><option>09:00 - 10:00</option><option>10:00 - 11:00</option><option>11:00 - 12:00</option><option>14:00 - 15:00</option></select></label>
            <label>Zone <select value={zone} onChange={e => setZone(e.target.value)}><option>Silent Pod Zone</option><option>Collab Pod Zone</option><option>Window Reading Pod Zone</option></select></label>
            <button className="btn accent" onClick={bookSeats}>Confirm Seat</button>
          </div>
        </div>

        <div className="card">
          <h3>Library Computer Booking</h3>
          <p>Reserve high-performance PCs while finalizing your pod slot.</p>
          <div className="form">
            <label>Computer Zone <select value={pcZone} onChange={e => setPcZone(e.target.value)}><option>Design Lab</option><option>Programming Hub</option><option>Data Science Bay</option></select></label>
            <label>Slot Duration <select value={pcDuration} onChange={e => setPcDuration(e.target.value)}><option>30 minutes</option><option>1 hour</option><option>2 hours</option></select></label>
            <button className="btn accent" onClick={reservePC}>Reserve PC</button>
          </div>
        </div>

        <div className="card">
          <h3>Select Seat</h3>
          <p className="sub">Legend: <span style={{ color: "var(--accent)", fontWeight: 600 }}>Available</span> &nbsp;
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>Selected</span> &nbsp;
            <span style={{ color: "#ef4444", fontWeight: 600 }}>Booked</span>
            {userRole === "admin" && <span style={{ marginLeft: 12 }}>• <span style={{ color: "#ef4444", fontWeight: 600 }}>Click booked seats to unbook (admin only)</span></span>}
          </p>
          <div className="form" style={{ marginBottom: 12 }}>
            <label>Number of Seats to Book
              <select value={seatCount} onChange={e => { setSeatCount(Number(e.target.value)); setSelectedSeats([]); }}>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} seat{n > 1 ? "s" : ""}</option>)}
              </select>
            </label>
          </div>
          <div className="seat-grid">
            {rows.map(row =>
              [1,2,3,4,5,6].map(num => {
                const seatId = `${row}${num}`;
                const seat = seats.find(s => s.id === seatId);
                const isOccupied = seat?.occupied && seat?.reservedBy !== user?.id;
                const isMyBooking = seat?.occupied && seat?.reservedBy === user?.id;
                const isSelected = selectedSeats.includes(seatId);
                let cls = "seat ";
                if (isOccupied || isMyBooking) cls += "booked";
                else if (isSelected) cls += "selected";
                else cls += "available";
                return (
                  <div key={seatId} className={cls}
                    onClick={() => {
                      if (userRole === "admin" && isOccupied) {
                        unbookSeat(seatId);
                      } else if (!isOccupied) {
                        toggleSeat(seatId);
                      }
                    }}
                    title={userRole === "admin" && isOccupied ? "Click to unbook" : isMyBooking ? "Your booking" : isOccupied ? "Occupied" : "Available"}
                    style={userRole === "admin" && isOccupied ? { cursor: "pointer", opacity: 0.8 } : {}}
                  >{seatId}</div>
                );
              })
            )}
          </div>
          <button className="btn primary full" onClick={bookSeats} disabled={selectedSeats.length === 0}>
            {selectedSeats.length > 0 ? `Book ${selectedSeats.length} Seat(s)` : "Book Selected Seats"}
          </button>
        </div>
      </div>

      {/* Booking History */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Your Booking History</h3>
        <div className="grid grid-2">
          <div>
            <h4>Seat Bookings ({history.seats.length})</h4>
            {history.seats.length === 0
              ? <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No seat bookings</p>
              : history.seats.map(s => (
                <div key={s.id} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, marginTop: 8 }}>
                  <strong>Seat {s.row}{s.number}</strong> &nbsp;
                  <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600 }}>Occupied</span>
                </div>
              ))
            }
          </div>
          <div>
            <h4>PC Reservations ({history.pcs.length})</h4>
            {history.pcs.length === 0
              ? <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No PC reservations</p>
              : history.pcs.map(p => (
                <div key={p.id} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, marginTop: 8 }}>
                  <strong>{p.pcNumber}</strong> — {p.timeSlot} <span style={{ color: "var(--muted)", fontSize: 12 }}>{p.date}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EVENTS & STUDY HUB
// ─────────────────────────────────────────────
function EventsHub({ user, userRole, onNotify }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [task, setTask] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [todos, setTodos] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", date: "", time: "", location: "", description: "" });

  function loadEvents(cat = "all") {
    const db = getDB();
    let list = db.events || [];
    if (cat !== "all") list = list.filter(e => e.category === cat);
    setEvents(list);
  }

  function loadTodos() {
    const db = getDB();
    setTodos((db.todoList || []).filter(t => t.userId === user?.id));
  }

  useEffect(() => { loadEvents(); loadTodos(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function isRegistered(eventId) {
    const db = getDB();
    return db.eventRegistrations?.some(r => r.eventId === eventId && r.userId === user?.id);
  }

  function isParticipating(eventId) {
    const db = getDB();
    return db.eventParticipations?.some(p => p.eventId === eventId && p.userId === user?.id);
  }

  function register(eventId) {
    if (!user) { onNotify("Please log in to register", "error"); return; }
    const db = getDB();
    if (isRegistered(eventId)) { onNotify("Already registered!", "info"); return; }
    const evIdx = db.events.findIndex(e => e.id === eventId);
    if (evIdx === -1) { onNotify("Event not found", "error"); return; }
    if (db.events[evIdx].registered >= db.events[evIdx].capacity) { onNotify("Event is full", "warning"); return; }
    if (!db.eventRegistrations) db.eventRegistrations = [];
    db.eventRegistrations.push({ id: "ER" + Date.now(), userId: user.id, eventId, registrationDate: new Date().toISOString().split("T")[0] });
    db.events[evIdx].registered++;
    saveDB(db);
    onNotify(`Registered for "${db.events[evIdx].title}"! ✅`, "success");
    loadEvents(filter);
  }

  function participate(eventId) {
    if (!user) { onNotify("Please log in to participate", "error"); return; }
    const db = getDB();
    if (isParticipating(eventId)) { onNotify("You are already participating!", "info"); return; }
    const evIdx = db.events.findIndex(e => e.id === eventId);
    if (evIdx === -1) { onNotify("Event not found", "error"); return; }
    if (db.events[evIdx].registered >= db.events[evIdx].capacity) { onNotify("This event is full. Try joining the waitlist.", "warning"); return; }
    if (!db.eventParticipations) db.eventParticipations = [];
    db.eventParticipations.push({ id: "EP" + Date.now(), userId: user.id, eventId, participationDate: new Date().toISOString().split("T")[0], status: "active" });
    db.events[evIdx].registered++;
    saveDB(db);
    onNotify(`You're now participating! 🎉`, "success");
    loadEvents(filter);
  }

  function startEdit(event) {
    setEditingEvent(event.id);
    setEditForm({ title: event.title, date: event.date, time: event.time, location: event.location, description: event.description });
  }

  function saveEdit() {
    if (!editingEvent) return;
    const db = getDB();
    const idx = db.events.findIndex(e => e.id === editingEvent);
    if (idx !== -1) {
      db.events[idx].title = editForm.title;
      db.events[idx].date = editForm.date;
      db.events[idx].time = editForm.time;
      db.events[idx].location = editForm.location;
      db.events[idx].description = editForm.description;
      saveDB(db);
      onNotify("Event updated successfully! ✅", "success");
      setEditingEvent(null);
      loadEvents(filter);
    }
  }

  function cancelEdit() {
    setEditingEvent(null);
  }

  function addTask(e) {
    e.preventDefault();
    if (!task) return;
    const db = getDB();
    if (!db.todoList) db.todoList = [];
    db.todoList.push({ id: "T" + Date.now(), userId: user?.id, task, time: taskTime || "—", completed: false });
    saveDB(db);
    setTask(""); setTaskTime("");
    onNotify("Task added! ✅", "success");
    loadTodos();
  }

  function removeTask(taskId) {
    const db = getDB();
    db.todoList = (db.todoList || []).filter(t => t.id !== taskId);
    saveDB(db);
    loadTodos();
  }

  const catBtn = (cat, label) => (
    <button className={`btn sm ${filter === cat ? "primary" : "ghost"}`} onClick={() => { setFilter(cat); loadEvents(cat); }}>{label}</button>
  );

  return (
    <div className="page">
      <div className="page-header"><h2>Events &amp; Study Hub</h2><p>Participate in library events, connect for group study, and plan your tasks.</p></div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {catBtn("all","All")}{catBtn("academic","Academic")}{catBtn("workshop","Workshop")}{catBtn("social","Social")}
      </div>

      {/* Event Edit Modal */}
      {editingEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 500, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
            <h3>Edit Event</h3>
            <div className="form">
              <label>Title <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></label>
              <label>Date <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></label>
              <label>Time <input type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} /></label>
              <label>Location <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} /></label>
              <label>Description <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} /></label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn primary" onClick={saveEdit} style={{ flex: 1 }}>Save Changes</button>
                <button className="btn ghost" onClick={cancelEdit} style={{ flex: 1 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event cards */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {events.map(ev => {
          const reg = isRegistered(ev.id);
          const part = isParticipating(ev.id);
          const full = ev.registered >= ev.capacity;
          return (
            <div key={ev.id} className="card">
              <div className="event-header">
                <h3>{ev.title}</h3>
                <span className={`event-category ${ev.category}`}>{ev.category}</span>
              </div>
              <div className="event-details">
                <p><strong>Date:</strong> {formatDate(ev.date)}</p>
                <p><strong>Time:</strong> {ev.time}</p>
                <p><strong>Location:</strong> {ev.location}</p>
                <p><strong>Description:</strong> {ev.description}</p>
                <p style={{ marginTop: 8, fontSize: 13 }}>{ev.registered}/{ev.capacity} registered</p>
                <div className="event-actions">
                  {reg
                    ? <button className="btn success sm" disabled>Registered ✅</button>
                    : full
                      ? <button className="btn ghost sm" onClick={() => onNotify("Added to waitlist! 📋", "success")}>Join Waitlist</button>
                      : <button className="btn primary sm" onClick={() => register(ev.id)}>Register Now</button>
                  }
                  <button className={`btn ghost sm ${part ? "" : ""}`} onClick={() => participate(ev.id)} disabled={part} style={part ? { color: "var(--primary)", borderColor: "var(--primary)" } : {}}>
                    {part ? "Participating" : "Participate"}
                  </button>
                  {userRole === "admin" && <button className="btn sm" style={{ background: "var(--border)", color: "var(--text)" }} onClick={() => startEdit(ev)}>Edit Event</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Upcoming Events</h3>
          <ul className="list">
            <li>Hackathon Warmup <span>Friday 4 PM</span></li>
            <li>AI Reading Circle <span>Saturday 11 AM</span></li>
            <li>Resume Review Booth <span>Monday 2 PM</span></li>
          </ul>
          <button className="btn accent" style={{ marginTop: 12 }} onClick={() => onNotify("Now participating in the event! 🎉", "success")}>Participate</button>
        </div>

        <div className="card">
          <h3>Group Study Match</h3>
          <p>Have a vacancy in your study team? Post and match randomly.</p>
          <div className="form">
            <label>Topic <input placeholder="DBMS revision / DSA practice" /></label>
            <label>Vacant Seats <input type="number" placeholder="2" min={1} max={6} /></label>
            <label>Preferred Slot <input type="time" /></label>
            <button className="btn primary" type="button" onClick={() => onNotify("Vacancy posted! Finding matches... 🔍", "success")}>Post Vacancy</button>
          </div>
        </div>

        <div className="card">
          <h3>My Tailored To-Do</h3>
          <p>Add tasks and keep your study streak alive.</p>
          <form className="form" onSubmit={addTask}>
            <label>Add Task <input value={task} onChange={e => setTask(e.target.value)} placeholder="Revise stacks and queues" /></label>
            <label>Due Time <input type="time" value={taskTime} onChange={e => setTaskTime(e.target.value)} /></label>
            <button className="btn ghost" type="submit">Add to List</button>
          </form>
          <ul className="list" style={{ marginTop: 12 }}>
            {todos.length === 0 && <li style={{ color: "var(--muted)", fontStyle: "italic" }}>No tasks yet. Add one above!</li>}
            {todos.map(t => (
              <li key={t.id}>{t.task} <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{t.time} <button onClick={() => removeTask(t.id)} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, padding: "1px 6px", cursor: "pointer", fontSize: 11 }}>×</button></span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Study Videos (YouTube)</h3>
          <div className="pill-list">
            {[
              ["Data Structures Crash Course","https://www.youtube.com/watch?v=8hly31xKli0"],
              ["Python for Beginners","https://www.youtube.com/watch?v=rfscVS0vtbw"],
              ["System Design Basics","https://www.youtube.com/watch?v=RBSGKlAvoiM"],
              ["JavaScript Full Course","https://www.youtube.com/watch?v=PkZNo7MFNFg"],
              ["DBMS in One Shot","https://www.youtube.com/watch?v=7S_tz1z_5bA"],
              ["Operating Systems Overview","https://www.youtube.com/watch?v=3qBXWUpoPHo"],
              ["Computer Networks Basics","https://www.youtube.com/watch?v=U4Jj0FHr5M4"],
              ["DSA Revision Sprint","https://www.youtube.com/watch?v=8mAITcNt710"]
            ].map(([label, url]) => <a key={label} className="pill" href={url} target="_blank" rel="noopener noreferrer">{label}</a>)}
          </div>
        </div>
        <div className="card spotlight">
          <h3>Event Participation Desk</h3>
          <div className="form">
            <label>Event Name <select><option>Hackathon Warmup</option><option>AI Reading Circle</option><option>Resume Review Booth</option></select></label>
            <label>Student ID <input placeholder="STU2024" /></label>
            <button className="btn primary" type="button" onClick={() => onNotify("Registered successfully for the event! 🎟️", "success")}>Register Now</button>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Study Music Lounge 🎧</h3>
          <p>Play focused playlists while reading or coding.</p>
          <div className="pill-list">
            {[["Lo-fi Focus","https://www.youtube.com/watch?v=Xf3-4A-uEc8"],["Deep Work Beats","https://www.youtube.com/watch?v=6lEY524RESQ"],["Calm Night Study","https://www.youtube.com/watch?v=l-2hOKIrIyI"]].map(([l,u]) => <a key={l} className="pill" href={u} target="_blank" rel="noopener noreferrer">{l}</a>)}
          </div>
        </div>
        <div className="card">
          <h3>Animated Study Backgrounds</h3>
          <p>Choose a visual mood while you study.</p>
          <div className="pill-list">
            {[["Lo-fi Focus Background","https://www.youtube.com/watch?v=sF80I-TQiW0"],["Deep Work Beats Background","https://www.youtube.com/watch?v=DfSkKYQiwoU"]].map(([l,u]) => <a key={l} className="pill" href={u} target="_blank" rel="noopener noreferrer">{l}</a>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HISTORY & PROFILE
// ─────────────────────────────────────────────
function HistoryProfile({ user, userRole, onNotify }) {
  const [history, setHistory] = useState([]);
  const [allBooks, setAllBooks] = useState([]);

  useEffect(() => {
    const db = getDB();
    const myIssues = (db.issuedBooks || []).filter(i => i.userId === user?.id);
    setHistory(myIssues.filter(i => i.returned));
    setAllBooks(db.books || []);
  }, [user]);

  const getBook = (bookId) => allBooks.find(b => b.id === bookId);

  return (
    <div className="page">
      <div className="page-header"><h2>History &amp; Profile</h2><p>Your past activity and student details in one place.</p></div>

      <div className="grid grid-2">
        {userRole === "student" && (
          <div className="card">
            <h3>Issue History</h3>
            {history.length === 0
              ? <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No returned books yet.</p>
              : <ul className="list">{history.map(i => {
                  const book = getBook(i.bookId);
                  return book ? <li key={i.id}>{book.title} <span>Returned • {formatDate(i.returnDate || i.dueDate)}</span></li> : null;
                })}</ul>
            }
          </div>
        )}

        {userRole === "student" && (
          <div className="card">
            <h3>Student Profile</h3>
            <p><strong>Name:</strong> {user?.name || "Aarav Mehta"}</p>
            <p><strong>Department:</strong> CSE</p>
            <p><strong>Semester:</strong> 5</p>
            <p><strong>Membership:</strong> <span className="badge active">Active</span></p>
          </div>
        )}

        {userRole === "admin" && (
          <div className="card">
            <h3>Admin Activity Log</h3>
            <ul className="list">
              <li>Fine waived for STU2044 <span>₹50</span></li>
              <li>Book replaced: OS Concepts <span>BK-1124</span></li>
              <li>Room booking approved <span>Innovation Hub</span></li>
            </ul>
          </div>
        )}
        {userRole === "admin" && (
          <div className="card">
            <h3>Admin Profile</h3>
            <p><strong>Name:</strong> {user?.name || "Riya Sharma"}</p>
            <p><strong>Role:</strong> Library Administrator</p>
            <p><strong>Shift:</strong> 9 AM – 5 PM</p>
            <p><strong>Access:</strong> Full Control</p>
          </div>
        )}
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Learning Timeline</h3>
          <p>Track your semester reading flow.</p>
          <ul className="list">
            <li>Week 1 <span>5 books explored</span></li>
            <li>Week 2 <span>2 books issued</span></li>
            <li>Week 3 <span>1 late return</span></li>
            <li>Week 4 <span>3 new genres</span></li>
          </ul>
        </div>
        <div className="card">
          <h3>Achievements</h3>
          <p>Your recent library badges.</p>
          <div className="pill-list">
            <span className="pill">Early Bird 📅</span>
            <span className="pill">No-Fine Month ✅</span>
            <span className="pill">Genre Explorer 🧭</span>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>Next badge: Night Owl Reader</p>
        </div>
        <div className="card">
          <h3>Top Genres</h3>
          <p>Your most-read categories this term.</p>
          <ul className="list">
            <li>AI &amp; ML <span>7 books</span></li>
            <li>Design <span>4 books</span></li>
            <li>Productivity <span>3 books</span></li>
          </ul>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Wishlist</h3>
          <p>Books you want next in the library.</p>
          <ul className="list">
            <li>Designing Data-Intensive Apps <span>Requested</span></li>
            <li>Thinking in Systems <span>Requested</span></li>
            <li>The Pragmatic Programmer <span>Queued</span></li>
          </ul>
        </div>
        <div className="card">
          <h3>Reading Insights</h3>
          <p>See your month in a snapshot.</p>
          <div className="pill-list">
            <span className="pill">Avg. daily study: 52 min</span>
            <span className="pill">Preferred time: 6–8 PM</span>
            <span className="pill">Completed: 4 books</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN CONTROLS
// ─────────────────────────────────────────────
function AdminControls({ onNotify }) {
  const [recentIssues, setRecentIssues] = useState([]);
  const [allBooks, setAllBooks] = useState([]);

  useEffect(() => {
    const db = getDB();
    setAllBooks(db.books || []);
    setRecentIssues((db.issuedBooks || []).filter(i => !i.returned).slice(0, 5));
  }, []);

  const getBook = (bookId) => allBooks.find(b => b.id === bookId);

  return (
    <div className="page">
      <div className="page-header"><h2>Admin Control Center</h2><p>Command your library operations with smart, student-safe tools.</p></div>

      <div className="grid grid-3">
        <div className="card spotlight">
          <h3>Fine Studio</h3>
          <p>Apply or waive fines with reason tracking.</p>
          <div className="admin-actions">
            <label className="form">Student ID <input placeholder="STU2024" /></label>
            <label className="form">Fine Amount (₹) <input type="number" placeholder="e.g. 75" /></label>
            <label className="form">Reason <input placeholder="Late return / Damage" /></label>
            <button className="btn accent" onClick={() => onNotify("Ledger updated successfully! ✅", "success")}>Update Ledger</button>
          </div>
        </div>
        <div className="card spotlight">
          <h3>Inventory Health</h3>
          <p>Flag damaged books and request replacements.</p>
          <div className="admin-actions">
            <label className="form">Book ID <input placeholder="BK-1124" /></label>
            <label className="form">Condition <select><option>Good</option><option>Damaged</option><option>Lost</option></select></label>
            <button className="btn ghost" onClick={() => onNotify("Replacement request sent! ✅", "success")}>Send Replacement Request</button>
          </div>
        </div>
        <div className="card spotlight">
          <h3>Issue Approval Queue</h3>
          <p>Approve manual issue/return requests in seconds.</p>
          <div className="pill-list" style={{ margin: "10px 0" }}>
            <span className="pill">STU2024 • "Design Patterns"</span>
            <span className="pill">STU3021 • "AI Basics"</span>
            <span className="pill">STU1150 • "Clean Code"</span>
          </div>
          <button className="btn primary" onClick={() => onNotify("Selected requests approved! ✅", "success")}>Approve Selected</button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Resource Booking Supervisor</h3>
          <p>Manage private rooms &amp; computer kiosks.</p>
          <div className="admin-actions">
            <label className="form">Booking Type <select><option>Study Room</option><option>Computer Desk</option></select></label>
            <label className="form">Priority Level <select><option>Normal</option><option>Exam Week Priority</option></select></label>
            <button className="btn accent" onClick={() => onNotify("Priority applied! ✅", "success")}>Apply Priority</button>
          </div>
        </div>
        <div className="card">
          <h3>Smart Announcements</h3>
          <p>Push alerts to students instantly.</p>
          <div className="admin-actions">
            <label className="form">Announcement <input placeholder="Library open till 9 PM" /></label>
            <label className="form">Audience <select><option>All Students</option><option>Final Year</option><option>New Members</option></select></label>
            <button className="btn primary" onClick={() => onNotify("Announcement broadcast to all students! 📢", "success")}>Broadcast</button>
          </div>
        </div>
        <div className="card">
          <h3>Noise &amp; Seat Monitor</h3>
          <p>Balance silent and group study zones.</p>
          <div className="pill-list" style={{ margin: "10px 0" }}>
            <span className="pill">Block A: Silent ✅</span>
            <span className="pill">Block B: Moderate ⚠️</span>
            <span className="pill">Block C: Active 🎧</span>
          </div>
          <button className="btn ghost" onClick={() => onNotify("Quiet reminder sent! 🔇", "success")}>Send Quiet Reminder</button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Membership Upgrades</h3>
          <p>Grant premium lounge or extended loan access.</p>
          <div className="admin-actions">
            <label className="form">Student ID <input placeholder="STU2024" /></label>
            <label className="form">Membership Tier <select><option>Standard</option><option>Premium Lounge</option><option>Research+</option></select></label>
            <button className="btn accent" onClick={() => onNotify("Membership upgraded! ✅", "success")}>Upgrade Plan</button>
          </div>
        </div>
        <div className="card">
          <h3>Library Analytics Pulse</h3>
          <p>Weekly operational highlights.</p>
          <ul className="list">
            <li>Peak check-ins <span>1:30 PM – 3 PM</span></li>
            <li>Top genre <span>AI &amp; ML</span></li>
            <li>Most booked room <span>Innovation Hub</span></li>
            <li>Avg. return time <span>4.2 days</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
function Sidebar({ currentPage, onNavigate, onLogout, userRole, collapsed }) {
  const links = [
    { id: "dashboard", label: "🏠 Home" },
    { id: "catalog", label: "📚 Book Catalog" },
    { id: "issue", label: "🧾 Issue / Return" },
    { id: "pod", label: "🪑 Pod Booking" },
    { id: "events", label: "🎟️ Events & Study Hub" },
    { id: "history", label: "🧑‍🎓 History / Profile" },
    ...(userRole === "admin" ? [{ id: "admin", label: "🛡️ Admin Controls" }] : [])
  ];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div>
        <div className="brand">
          <span className="brand-icon">📚</span>
          <div><h1>Smart Library</h1><p>Student-friendly portal</p></div>
        </div>
        <nav className="nav" style={{ marginTop: 24 }}>
          {links.map(l => (
            <button key={l.id} className={`nav-link ${currentPage === l.id ? "active" : ""}`} onClick={() => onNavigate(l.id)}>{l.label}</button>
          ))}
        </nav>
      </div>
      <div className="sidebar-footer">
        <button className="nav-link" onClick={onLogout}>Log out</button>
        <p className="hint">Tip: Use the hotbar icons for quick jumps ✨</p>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// ROOT APP COMPONENT
// ─────────────────────────────────────────────
export default function App() {
  // ALL useState/useToast hooks MUST come before any useEffect
  // (React Rules of Hooks: hooks must always be called in the same order)
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [page, setPage] = useState("login");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const { toasts, show: notify } = useToast();

  // useEffect hooks come AFTER all useState hooks
  // Sync dark-theme class on document.body for full-page background coverage
  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  }, [theme]);

  // Initialize DB and restore session on first mount
  useEffect(() => {
    initDB();
    // Restore session
    const session = localStorage.getItem("userSession");
    if (session) {
      const s = JSON.parse(session);
      if (Date.now() - s.timestamp < 24 * 60 * 60 * 1000) {
        setUser(s.user);
        setUserRole(s.role);
        setPage("dashboard");
      }
    }
    notify("Smart Library loaded! Demo: STU2024 / Read@2024", "success", 3000);
  }, []);

  function handleLogin(role, userData) {
    setShowLoading(true);
    setTimeout(() => {
      setUser(userData);
      setUserRole(role);
      const session = { user: userData, role, timestamp: Date.now() };
      localStorage.setItem("userSession", JSON.stringify(session));
      setPage("dashboard");
      setShowLoading(false);
      notify(`Welcome back, ${userData.name}! 👋`, "success");
    }, 1000);
  }

  function handleLogout() {
    setUser(null);
    setUserRole(null);
    localStorage.removeItem("userSession");
    setPage("login");
    notify("Logged out successfully", "info");
  }

  const isLoggedIn = !!user;

  function renderPage() {
    if (page === "login") return <LoginPage onLogin={handleLogin} onGoSignup={() => setPage("signup")} onNotify={notify} />;
    if (page === "signup") return <SignupPage onBack={() => setPage("login")} onNotify={notify} />;
    if (page === "dashboard") return <Dashboard user={user} onNotify={notify} />;
    if (page === "catalog") return <BookCatalog user={user} onNotify={notify} />;
    if (page === "issue") return <IssueReturn user={user} userRole={userRole} onNotify={notify} />;
    if (page === "pod") return <PodBooking user={user} userRole={userRole} onNotify={notify} />;
    if (page === "events") return <EventsHub user={user} userRole={userRole} onNotify={notify} />;
    if (page === "history") return <HistoryProfile user={user} userRole={userRole} onNotify={notify} />;
    if (page === "admin") return userRole === "admin" ? <AdminControls onNotify={notify} /> : <div className="page"><p>Access denied.</p></div>;
    return <Dashboard user={user} onNotify={notify} />;
  }

  return (
    <>
      {/* Inject styles */}
      <style>{STYLES}</style>

      <div className={`app-root ${theme === "dark" ? "dark-theme" : ""}`}>
        {/* Loading overlay */}
        {showLoading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <h2>Welcome to Smart Library</h2>
              <p>Loading your personalized experience...</p>
              <div className="loading-spinner" />
            </div>
          </div>
        )}

        {/* Sidebar — only when logged in */}
        {isLoggedIn && (
          <Sidebar
            currentPage={page}
            onNavigate={setPage}
            onLogout={handleLogout}
            userRole={userRole}
            collapsed={sidebarCollapsed}
          />
        )}

        {/* Main content */}
        <div className="content">
          {/* Topbar — only when logged in */}
          {isLoggedIn && (
            <div className="topbar">
              <button className="icon-btn" onClick={() => setSidebarCollapsed(c => !c)} title="Toggle sidebar">☰</button>
              <div className="hotbar">
                <button className="hotbar-btn" onClick={() => setPage("dashboard")} title="Dashboard">🏠</button>
                <button className="hotbar-btn" onClick={() => setPage("catalog")} title="Catalog">📖</button>
                <button className="hotbar-btn" onClick={() => setPage("issue")} title="Issue / Return">🧾</button>
                <button className="hotbar-btn" onClick={() => setPage("pod")} title="Pod Booking">🪑</button>
                <button className="hotbar-btn" onClick={() => setPage("events")} title="Events">🎟️</button>
                <button className="hotbar-btn" onClick={() => setPage("history")} title="History">🕒</button>
                {userRole === "admin" && <button className="hotbar-btn" onClick={() => setPage("admin")} title="Admin Controls">🛡️</button>}
              </div>
              <div className="theme-selector">
                <button className="theme-btn" onClick={() => { setTheme("dark"); localStorage.setItem("theme","dark"); }} title="Dark mode">🌙</button>
                <button className="theme-btn" onClick={() => { setTheme("light"); localStorage.setItem("theme","light"); }} title="Light mode">☀️</button>
              </div>
            </div>
          )}

          {/* Pre-login theme toggle */}
          {!isLoggedIn && (
            <div style={{ position: "fixed", top: 16, right: 16, zIndex: 999, display: "flex", gap: 6 }}>
              <button className="theme-btn" onClick={() => { setTheme("dark"); localStorage.setItem("theme","dark"); }}>🌙</button>
              <button className="theme-btn" onClick={() => { setTheme("light"); localStorage.setItem("theme","light"); }}>☀️</button>
            </div>
          )}

          {renderPage()}
        </div>

        <ToastContainer toasts={toasts} />
      </div>
    </>
  );
}
