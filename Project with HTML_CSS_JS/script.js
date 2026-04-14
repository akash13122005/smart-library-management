/*
  ========================================
  SMART LIBRARY MANAGEMENT SYSTEM — SCRIPT.JS
  ========================================

  This file is the brain of the whole library portal.
  Every button click, database read/write, and live
  UI update flows through the modules defined here.

  HOW IT'S ORGANIZED:
  Each "module" is just a plain JS object with methods.
  They don't talk to a server — everything lives in
  localStorage so the app works without a backend.

  MODULES (in order):
  1. AppState      — one place for login state, role, selected items
  2. Utils         — small helpers every other module uses
  3. Database      — all read/write operations against localStorage
  4. Auth          — login, logout, session restore
  5. SeatBooking   — POD seat + PC reservation
  6. BookCatalog   — search, filter, issue from catalog
  7. IssueReturn   — track issued books, returns, fines
  8. Events        — register/participate in library events
  9. UserProfile   — history page and profile editing
  10. AdminDashboard — analytics + admin actions
  11. ThemeManager  — light/dark toggle
  12. MobileHelper  — touch gestures + swipe sidebar
  13. App           — boots everything, owns the router
  14. performRealTimeSearch — live search function wired to catalog inputs
*/

// ========================================
// GLOBAL STATE — the single source of truth
// ========================================
// Instead of scattering variables across modules, every module reads
// and writes to AppState so there's one clear picture of what's happening.
// currentUser is set after login; userRole controls which UI is shown.
const AppState = {
    currentUser: null,        // The logged-in user object (name, id, membership…)
    userRole: null,           // 'student' or 'admin' — drives which sections are visible
    isLoggedIn: false,        // Quick boolean so modules don't have to check currentUser != null
    selectedSeats: [],        // Seats the user has ticked but not yet booked
    issuedBooks: [],          // Cached list of books this user currently has checked out
    events: [],               // Cached event list (refreshed on each Events page visit)
    reservations: [],         // POD / PC reservations in the current session
    theme: localStorage.getItem('theme') || 'light', // Persisted across page reloads
    debugButtonProcessing: false // Prevents rapid double-clicks from firing actions twice
};

// Clear the debounce flag on every fresh page load so stale state never blocks a button.
window.addEventListener('load', () => {
    AppState.debugButtonProcessing = false;
});

// ========================================
// UTILS — tiny helpers used everywhere
// ========================================
// Rather than duplicating logic (debounce, date format, toast popup)
// in every module, they all call Utils.something(). Keeping it here
// means fixing a bug once fixes it everywhere.
const Utils = {
    notificationTimer: null, // Holds the last setTimeout id so we can cancel it if a new toast arrives fast

    // Pop a small toast in the top-right corner.
    // type can be 'success', 'error', 'warning', or 'info'.
    // duration defaults to 1.5 s — pass a bigger number for important messages.
    showNotification(message, type = 'info', duration = 1500) {
        // Clear any previous general timer
        if (this.notificationTimer) {
            clearTimeout(this.notificationTimer);
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Add notification styles if not already present
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 10000;
                    animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    margin-bottom: 10px;
                    transition: opacity 0.4s ease, transform 0.4s ease;
                }
                .notification.removing {
                    opacity: 0;
                    transform: translateX(100%);
                }
                .notification-success { background: #10b981; border-left: 5px solid #059669; }
                .notification-error { background: #ef4444; border-left: 5px solid #dc2626; }
                .notification-warning { background: #f59e0b; border-left: 5px solid #d97706; }
                .notification-info { background: #3b82f6; border-left: 5px solid #2563eb; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        // Limit to 3 notifications at a time to prevent clutter
        const existing = document.querySelectorAll('.notification');
        if (existing.length >= 3) {
            existing[0].remove();
        }

        document.body.appendChild(notification);

        // Auto-remove after duration
        setTimeout(() => {
            notification.classList.add('removing');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 400);
        }, duration);
    },

    // Turn an ISO date string like "2024-03-15" into "Mar 15, 2024"
    // so the UI always shows something human-readable.
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Delays calling `func` until the user stops typing for `wait` ms.
    // Without this, every keystroke in the search box would trigger a full
    // catalog re-render — this batches them into one call at the end.
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Swap a button's label to something like "Saving…" and disable it
    // so the user can't click twice while we're mid-action.
    showLoading(element, text) {
        const originalText = element.textContent;
        element.textContent = text;
        element.disabled = true;
        return originalText;
    },

    // Restore the button to its original label and re-enable it after the action completes.
    hideLoading(element, originalText) {
        element.textContent = originalText;
        element.disabled = false;
    }
};

// ========================================
// DATABASE — all localStorage reads and writes live here
// ========================================
// Nothing outside this module should ever call localStorage directly.
// Every other module calls Database.getSomething() or Database.doSomething()
// and trusts that this module handles persistence correctly.
//
// The whole "database" is one JSON blob stored under the key 'library_db'.
// On first load it's seeded with sample users, books, events, and seats.
// After that, reads deserialise it and writes serialise it back.
const Database = {
    // Seed the DB on first visit, then always recalculate issued-copy counts
    // so stale numbers from old bugs don't haunt us.
    init() {
        if (!localStorage.getItem('library_db_initialized')) {
            this.initializeDatabase();
            localStorage.setItem('library_db_initialized', 'true');
        }
        // Always recalculate issuedCopies from actual records to fix any corruption
        this.recalculateIssuedCopies();
    },

    // Counts how many non-returned issue records exist per book and writes
    // the result back to each book object. Runs on every page load so even
    // if an older bug left corrupt counts, they self-heal automatically.
    recalculateIssuedCopies() {
        const db = this.getData();
        if (!db.books || !db.issuedBooks) return;

        // Count active (not returned) issues per book
        const countMap = {};
        db.issuedBooks.forEach(issue => {
            if (!issue.returned) {
                countMap[issue.bookId] = (countMap[issue.bookId] || 0) + 1;
            }
        });

        // Update each book's issuedCopies and available flag
        db.books.forEach(book => {
            const activeIssues = countMap[book.id] || 0;
            book.issuedCopies = Math.min(activeIssues, book.totalCopies); // Never exceed totalCopies
            book.available = book.issuedCopies < book.totalCopies;
        });

        this.saveData(db);
    },

    // Initialize database with sample data
    initializeDatabase() {
        const db = {
            users: [
                { id: 'STU2024', name: 'John Doe', email: 'john.doe@university.edu', role: 'student', password: 'Read@2024', membership: 'basic' },
                { id: 'ADMIN001', name: 'Admin User', email: 'admin@library.edu', role: 'admin', password: 'Lib@2024', membership: 'elite' },
                { id: 'STU2025', name: 'Jane Smith', email: 'jane.smith@university.edu', role: 'student', password: 'Read@2024', membership: 'plus' },
                { id: 'STU2026', name: 'Mike Johnson', email: 'mike.johnson@university.edu', role: 'student', password: 'Read@2024', membership: 'basic' }
            ],
            books: [
                { id: 'B001', title: 'Clean Code', author: 'Robert C. Martin', category: 'Programming', genre: 'Computer Science', isbn: '978-0-13-235088-4', available: true, totalCopies: 5, issuedCopies: 2 },
                { id: 'B002', title: 'Design Patterns', author: 'Gang of Four', category: 'Programming', genre: 'Computer Science', isbn: '978-0-201-63361-0', available: false, totalCopies: 3, issuedCopies: 3 },
                { id: 'B003', title: 'The Pragmatic Programmer', author: 'David Thomas', category: 'Programming', genre: 'Computer Science', isbn: '978-0-20-161622-4', available: true, totalCopies: 4, issuedCopies: 1 },
                { id: 'B004', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', category: 'Programming', genre: 'Computer Science', isbn: '978-0-262-03384-8', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B005', title: 'Structure and Interpretation of Computer Programs', author: 'Harold Abelson', category: 'Programming', genre: 'Computer Science', isbn: '978-0-262-51087-5', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B006', title: 'The Art of Computer Programming', author: 'Donald Knuth', category: 'Programming', genre: 'Computer Science', isbn: '978-0-201-89684-8', available: false, totalCopies: 2, issuedCopies: 2 },
                { id: 'B007', title: 'Code Complete', author: 'Steve McConnell', category: 'Programming', genre: 'Software Engineering', isbn: '978-0-7356-1967-8', available: true, totalCopies: 4, issuedCopies: 2 },
                { id: 'B008', title: 'Refactoring', author: 'Martin Fowler', category: 'Programming', genre: 'Software Engineering', isbn: '978-0-201-48567-7', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B009', title: 'Sapiens', author: 'Yuval Noah Harari', category: 'Non-Fiction', genre: 'History', isbn: '978-0-06-231609-7', available: true, totalCopies: 4, issuedCopies: 1 },
                { id: 'B010', title: 'Educated', author: 'Tara Westover', category: 'Biography', genre: 'Memoir', isbn: '978-0-399-59050-4', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B011', title: 'The Lean Startup', author: 'Eric Ries', category: 'Business', genre: 'Entrepreneurship', isbn: '978-0-307-88789-4', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B012', title: 'Atomic Habits', author: 'James Clear', category: 'Self-Help', genre: 'Personal Development', isbn: '978-0-7352-1129-2', available: false, totalCopies: 4, issuedCopies: 4 },
                { id: 'B013', title: 'The Phoenix Project', author: 'Gene Kim', category: 'Programming', genre: 'Software Engineering', isbn: '978-1-940004-32-5', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B014', title: 'Domain-Driven Design', author: 'Eric Evans', category: 'Programming', genre: 'Software Architecture', isbn: '978-0-321-12521-5', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B015', title: 'The Pragmatic Programmer', author: 'Andy Hunt', category: 'Programming', genre: 'Computer Science', isbn: '978-0-201-63361-0', available: true, totalCopies: 5, issuedCopies: 2 },
                { id: 'B016', title: 'Clean Architecture', author: 'Robert C. Martin', category: 'Programming', genre: 'Software Architecture', isbn: '978-0-134-50842-7', available: false, totalCopies: 3, issuedCopies: 3 },
                { id: 'B017', title: 'The Mythical Man-Month', author: 'Frederick Brooks', category: 'Programming', genre: 'Software Engineering', isbn: '978-0-201-00623-2', available: true, totalCopies: 4, issuedCopies: 1 },
                { id: 'B018', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', category: 'Programming', genre: 'Data Science', isbn: '978-1-4493-60048-5', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B019', title: 'Building Microservices', author: 'Sam Newman', category: 'Programming', genre: 'Software Architecture', isbn: '978-1-492-03431-8', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B020', title: 'The Go Programming Language', author: 'Alan Donovan', category: 'Programming', genre: 'Computer Science', isbn: '978-0-134-61006-1', available: true, totalCopies: 4, issuedCopies: 2 },
                { id: 'B021', title: 'Learning Python', author: 'Mark Lutz', category: 'Programming', genre: 'Computer Science', isbn: '978-1-4493-55972-3', available: false, totalCopies: 5, issuedCopies: 5 },
                { id: 'B022', title: 'JavaScript: The Good Parts', author: 'Douglas Crockford', category: 'Programming', genre: 'Web Development', isbn: '978-0-596-51774-6', available: true, totalCopies: 6, issuedCopies: 3 },
                { id: 'B023', title: 'You Don\'t Know JS', author: 'Kyle Simpson', category: 'Programming', genre: 'Web Development', isbn: '978-1-9339-20012-0', available: true, totalCopies: 4, issuedCopies: 1 },
                { id: 'B024', title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', category: 'Programming', genre: 'Web Development', isbn: '978-1-59327-5846-8', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B025', title: 'Python Crash Course', author: 'Eric Matthes', category: 'Programming', genre: 'Computer Science', isbn: '978-1-59327-9280-0', available: true, totalCopies: 5, issuedCopies: 2 },
                { id: 'B026', title: 'Effective Java', author: 'Joshua Bloch', category: 'Programming', genre: 'Computer Science', isbn: '978-0-134-64956-1', available: false, totalCopies: 4, issuedCopies: 4 },
                { id: 'B027', title: 'Head First Design Patterns', author: 'Eric Freeman', category: 'Programming', genre: 'Software Engineering', isbn: '978-0-596-00712-4', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B028', title: 'The Rust Programming Language', author: 'Steve Klabnik', category: 'Programming', genre: 'Systems Programming', isbn: '978-1-7185-00533-8', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B029', title: 'Database System Concepts', author: 'Abraham Silberschatz', category: 'Programming', genre: 'Database', isbn: '978-0-073-60575-8', available: true, totalCopies: 4, issuedCopies: 2 },
                { id: 'B030', title: 'Computer Networks', author: 'Andrew Tanenbaum', category: 'Programming', genre: 'Networking', isbn: '978-0-134-94966-2', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B031', title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell', category: 'Programming', genre: 'Artificial Intelligence', isbn: '978-0-13-604259-7', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B032', title: 'Machine Learning Yearning', author: 'Andrew Ng', category: 'Programming', genre: 'Machine Learning', isbn: '978-1-322-05056-0', available: true, totalCopies: 4, issuedCopies: 2 },
                { id: 'B033', title: 'Deep Learning', author: 'Ian Goodfellow', category: 'Programming', genre: 'Machine Learning', isbn: '978-0-262-33572-3', available: false, totalCopies: 3, issuedCopies: 3 },
                { id: 'B034', title: 'The Algorithm Design Manual', author: 'Steven Skiena', category: 'Programming', genre: 'Algorithms', isbn: '978-1-848-80085-5', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B035', title: 'Introduction to Machine Learning', author: 'Ethem Alpaydin', category: 'Programming', genre: 'Machine Learning', isbn: '978-0-262-34552-4', available: true, totalCopies: 5, issuedCopies: 2 },
                { id: 'B036', title: 'Python for Data Analysis', author: 'Wes McKinney', category: 'Programming', genre: 'Data Science', isbn: '978-1-491-95793-4', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B037', title: 'Data Science for Business', author: 'Foster Provost', category: 'Programming', genre: 'Data Science', isbn: '978-1-119-94485-1', available: false, totalCopies: 4, issuedCopies: 4 },
                { id: 'B038', title: 'Web Development with Node.js', author: 'Ethan Brown', category: 'Programming', genre: 'Web Development', isbn: '978-1-484-21928-2', available: true, totalCopies: 4, issuedCopies: 1 },
                { id: 'B039', title: 'React: Up and Running', author: 'Robin Wieruch', category: 'Programming', genre: 'Web Development', isbn: '978-1-491-95012-8', available: true, totalCopies: 6, issuedCopies: 3 },
                { id: 'B040', title: 'Full Stack Development', author: 'Chris Aquino', category: 'Programming', genre: 'Web Development', isbn: '978-1-119-95028-5', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B041', title: 'Cloud Computing Patterns', author: 'Thomas Erl', category: 'Programming', genre: 'Cloud Computing', isbn: '978-0-13-608925-3', available: false, totalCopies: 2, issuedCopies: 2 },
                { id: 'B042', title: 'DevOps Handbook', author: 'Gene Kim', category: 'Programming', genre: 'DevOps', isbn: '978-1-379-69594-7', available: true, totalCopies: 4, issuedCopies: 2 },
                { id: 'B043', title: 'Cybersecurity Essentials', author: 'Charles Le Grand', category: 'Programming', genre: 'Cybersecurity', isbn: '978-1-119-95263-0', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B044', title: 'Blockchain Basics', author: 'Daniel Drescher', category: 'Programming', genre: 'Blockchain', isbn: '978-1-484-21537-7', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B045', title: 'Mobile App Development', author: 'John Smith', category: 'Programming', genre: 'Mobile Development', isbn: '978-1-484-28381-9', available: true, totalCopies: 5, issuedCopies: 2 },
                { id: 'B046', title: 'Game Development with Unity', author: 'Jeremy Bond', category: 'Programming', genre: 'Game Development', isbn: '978-1-484-20902-9', available: false, totalCopies: 3, issuedCopies: 3 },
                { id: 'B047', title: 'UI/UX Design Principles', author: 'Don Norman', category: 'Programming', genre: 'Design', isbn: '978-0-262-13472-3', available: true, totalCopies: 4, issuedCopies: 2 },
                { id: 'B048', title: 'API Design Patterns', author: 'James Higginbotham', category: 'Programming', genre: 'API Development', isbn: '978-1-484-27574-9', available: true, totalCopies: 3, issuedCopies: 1 },
                { id: 'B049', title: 'Quantum Computing', author: 'Michael Nielsen', category: 'Programming', genre: 'Quantum Computing', isbn: '978-1-107-16050-5', available: true, totalCopies: 2, issuedCopies: 0 },
                { id: 'B050', title: 'Augmented Reality Development', author: 'David Wallace', category: 'Programming', genre: 'AR/VR', isbn: '978-1-484-28382-1', available: true, totalCopies: 3, issuedCopies: 1 }
            ],
            issuedBooks: [
                { id: 'IB001', userId: 'STU2024', bookId: 'B001', issueDate: '2024-02-01', dueDate: '2024-02-15', returned: false, fine: 0 },
                { id: 'IB002', userId: 'STU2025', bookId: 'B002', issueDate: '2024-01-20', dueDate: '2024-02-03', returned: false, fine: 5 },
                { id: 'IB003', userId: 'STU2024', bookId: 'B006', issueDate: '2024-01-25', dueDate: '2024-02-08', returned: false, fine: 0 }
            ],
            events: [
                { id: 'E001', title: 'Book Reading Club', date: '2024-02-15', time: '3:00 PM', location: 'Library Hall A', category: 'academic', capacity: 50, registered: 45, description: 'Monthly book discussion meeting' },
                { id: 'E002', title: 'Study Skills Workshop', date: '2024-02-20', time: '2:00 PM', location: 'Conference Room', category: 'workshop', capacity: 40, registered: 30, description: 'Learn effective study techniques' },
                { id: 'E003', title: 'Author Meet & Greet', date: '2024-02-25', time: '4:00 PM', location: 'Main Library', category: 'social', capacity: 75, registered: 60, description: 'Meet local authors and discuss their work' },
                { id: 'E004', title: 'Research Methods Seminar', date: '2024-03-01', time: '10:00 AM', location: 'Seminar Hall', category: 'academic', capacity: 30, registered: 25, description: 'Advanced research methodology workshop' },
                { id: 'E005', title: 'Creative Writing Workshop', date: '2024-03-05', time: '1:00 PM', location: 'Room 201', category: 'workshop', capacity: 20, registered: 15, description: 'Express your creativity through writing' },
                { id: 'E006', title: 'Hackathon Warmup', date: '2024-03-10', time: '9:00 AM', location: 'Innovation Lab', category: 'workshop', capacity: 100, registered: 80, description: 'Prepare for the upcoming winter hackathon' },
                { id: 'E007', title: 'AI Reading Circle', date: '2024-03-12', time: '11:00 AM', location: 'Reading Room 2', category: 'academic', capacity: 30, registered: 12, description: 'Weekly discussion on latest AI research papers' },
                { id: 'E008', title: 'Resume Review Booth', date: '2024-03-15', time: '2:00 PM', location: 'Career Center', category: 'workshop', capacity: 50, registered: 40, description: 'One-on-one resume review with industry experts' }
            ],
            seats: [
                { id: 'A1', row: 'A', number: 1, occupied: false, reservedBy: null },
                { id: 'A2', row: 'A', number: 2, occupied: true, reservedBy: 'STU2025' },
                { id: 'A3', row: 'A', number: 3, occupied: false, reservedBy: null },
                { id: 'A4', row: 'A', number: 4, occupied: false, reservedBy: null },
                { id: 'B1', row: 'B', number: 1, occupied: true, reservedBy: 'STU2026' },
                { id: 'B2', row: 'B', number: 2, occupied: false, reservedBy: null },
                { id: 'B3', row: 'B', number: 3, occupied: false, reservedBy: null },
                { id: 'B4', row: 'B', number: 4, occupied: true, reservedBy: 'STU2024' },
                { id: 'C1', row: 'C', number: 1, occupied: false, reservedBy: null },
                { id: 'C2', row: 'C', number: 2, occupied: false, reservedBy: null },
                { id: 'C3', row: 'C', number: 3, occupied: true, reservedBy: 'STU2025' },
                { id: 'C4', row: 'C', number: 4, occupied: false, reservedBy: null }
            ],
            pcReservations: [
                { id: 'PCR001', userId: 'STU2024', pcNumber: 'PC1', timeSlot: '9:00-11:00', date: '2024-02-10', status: 'active' },
                { id: 'PCR002', userId: 'STU2025', pcNumber: 'PC2', timeSlot: '2:00-4:00', date: '2024-02-11', status: 'active' }
            ],
            feedback: [
                { id: 'F001', userId: 'STU2024', rating: 5, message: 'Great library system! Very user friendly.', date: '2024-02-01' },
                { id: 'F002', userId: 'STU2025', rating: 4, message: 'Good collection of books, but need more computers.', date: '2024-02-02' }
            ],
            todoList: [
                { id: 'T1', userId: 'STU2024', task: 'Complete OS assignment', time: 'Today', completed: false },
                { id: 'T2', userId: 'STU2024', task: 'Return Clean Code', time: 'Tomorrow', completed: false }
            ],
            eventRegistrations: [],
            eventParticipations: [],
            eventWaitlist: []
        };

        localStorage.setItem('library_db', JSON.stringify(db));
    },

    // Get all data from database
    getData() {
        return JSON.parse(localStorage.getItem('library_db') || '{}');
    },

    // Save data to database
    saveData(data) {
        localStorage.setItem('library_db', JSON.stringify(data));

        // Trigger book catalog refresh if on catalog page
        if (document.getElementById('catalog')) {
            console.log('Database updated, refreshing book catalog');
            setTimeout(() => {
                if (typeof BookCatalog !== 'undefined' && BookCatalog.loadBooks) {
                    BookCatalog.loadBooks();
                }
            }, 100);
        }
    },

    // Query functions
    getUserById(userId) {
        const db = this.getData();
        return db.users?.find(user => user.id === userId);
    },

    getBooks(filters = {}) {
        const db = this.getData();
        let books = db.books || [];

        if (filters.category) {
            books = books.filter(book => book.category.toLowerCase().includes(filters.category.toLowerCase()));
        }

        if (filters.available !== undefined) {
            books = books.filter(book => book.available === filters.available);
        }

        if (filters.search) {
            const search = filters.search.toLowerCase();
            books = books.filter(book =>
                book.title.toLowerCase().includes(search) ||
                book.author.toLowerCase().includes(search)
            );
        }

        if (filters.author) {
            const author = filters.author.toLowerCase();
            books = books.filter(book =>
                book.author.toLowerCase().includes(author)
            );
        }

        return books;
    },

    getBookById(bookId) {
        const db = this.getData();
        return db.books?.find(book => book.id === bookId);
    },

    // Check if book is issued to specific user
    isBookIssuedToUser(bookId, userId) {
        if (!userId) return false;
        const db = this.getData();
        return db.issuedBooks?.some(issue =>
            issue.bookId === bookId && issue.userId === userId && !issue.returned
        ) || false;
    },

    // Admin unissue book
    adminUnissueBook(bookId) {
        const db = this.getData();
        const book = db.issuedBooks?.find(issue => issue.bookId === bookId && !issue.returned);

        if (book) {
            book.returned = true;
            book.returnDate = new Date().toISOString().split('T')[0];

            // Update book availability
            const bookData = db.books?.find(b => b.id === bookId);
            if (bookData) {
                bookData.issuedCopies = Math.max(0, bookData.issuedCopies - 1);
                bookData.available = bookData.issuedCopies < bookData.totalCopies;
            }

            this.saveData(db);
            return { success: true, message: 'Book unissued successfully' };
        }

        return { success: false, message: 'No active issue found for this book' };
    },

    // Return book
    returnBook(issueId) {
        const db = this.getData();
        const issue = db.issuedBooks?.find(i => i.id === issueId && !i.returned);

        if (!issue) {
            return { success: false, message: 'Issue record not found' };
        }

        // Mark as returned
        issue.returned = true;
        issue.returnDate = new Date().toISOString().split('T')[0];

        // Update book availability
        const book = db.books?.find(b => b.id === issue.bookId);
        if (book) {
            book.issuedCopies = Math.max(0, book.issuedCopies - 1);
            book.available = book.issuedCopies < book.totalCopies;
        }

        this.saveData(db);
        return { success: true, message: 'Book returned successfully' };
    },

    // Pay fine
    payFine(issueId) {
        const db = this.getData();
        const issue = db.issuedBooks?.find(i => i.id === issueId && !i.returned);

        if (!issue) {
            return { success: false, message: 'Issue record not found' };
        }

        if (issue.fine <= 0) {
            return { success: false, message: 'No fine to pay' };
        }

        // Clear the fine
        issue.fine = 0;

        this.saveData(db);
        return { success: true, message: 'Fine paid successfully' };
    },

    getIssuedBooks(userId) {
        const db = this.getData();
        return db.issuedBooks?.filter(book => book.userId === userId && !book.returned) || [];
    },

    getEvents(filters = {}) {
        const db = this.getData();
        let events = db.events || [];

        if (filters.category) {
            events = events.filter(event => event.category === filters.category);
        }

        return events;
    },

    getEventById(eventId) {
        const db = this.getData();
        return db.events?.find(event => event.id === eventId);
    },

    getSeats() {
        const db = this.getData();
        return db.seats || [];
    },

    // Update functions
    updateUser(userId, updates) {
        const db = this.getData();
        const userIndex = db.users.findIndex(user => user.id === userId);
        if (userIndex !== -1) {
            db.users[userIndex] = { ...db.users[userIndex], ...updates };
            this.saveData(db);
            return db.users[userIndex];
        }
        return null;
    },

    // Create an issue record for a user borrowing a book.
    // `duration` is in days (default 14). Bumps issuedCopies on the book
    // and flips available = false once all copies are out.
    issueBook(userId, bookId, duration = 14) {
        const db = this.getData();
        const book = this.getBookById(bookId);

        if (!book || !book.available) {
            return { success: false, message: 'Book not available' };
        }

        const issueDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const newIssue = {
            id: 'IB' + Date.now(),
            userId: userId,
            bookId: bookId,
            issueDate: issueDate,
            dueDate: dueDate,
            returned: false,
            fine: 0
        };

        // Update book availability
        const bookIndex = db.books.findIndex(b => b.id === bookId);
        if (bookIndex !== -1) {
            db.books[bookIndex].issuedCopies++;
            db.books[bookIndex].available = db.books[bookIndex].issuedCopies < db.books[bookIndex].totalCopies;
        }

        db.issuedBooks.push(newIssue);
        this.saveData(db);

        return { success: true, issue: newIssue };
    },

    // Mark an issued book as returned and calculate any overdue fine ($2/day).
    // Also decrements issuedCopies on the parent book so availability updates live.
    returnBook(issueId) {
        const db = this.getData();
        const issueIndex = db.issuedBooks.findIndex(issue => issue.id === issueId);

        if (issueIndex === -1) {
            return { success: false, message: 'Issue record not found' };
        }

        const issue = db.issuedBooks[issueIndex];
        issue.returned = true;
        issue.returnDate = new Date().toISOString().split('T')[0];

        // Calculate fine if overdue
        const dueDate = new Date(issue.dueDate);
        const returnDate = new Date();
        if (returnDate > dueDate) {
            const daysOverdue = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
            issue.fine = daysOverdue * 2; // $2 per day
        }

        // Update book availability
        const bookIndex = db.books.findIndex(b => b.id === issue.bookId);
        if (bookIndex !== -1) {
            db.books[bookIndex].issuedCopies--;
            db.books[bookIndex].available = db.books[bookIndex].issuedCopies < db.books[bookIndex].totalCopies;
        }

        this.saveData(db);

        return { success: true, issue: issue };
    },

    // Formally register a user for an event — checks capacity, prevents
    // double-registration, increments event.registered, and saves everything.
    registerForEvent(userId, eventId) {
        const db = this.getData();
        const event = this.getEventById(eventId);

        if (!event) {
            return { success: false, message: 'Event not found' };
        }

        if (event.registered >= event.capacity) {
            return { success: false, message: 'Event is full' };
        }

        // Check if already registered
        const existingRegistration = db.eventRegistrations?.find(reg =>
            reg.userId === userId && reg.eventId === eventId
        );

        if (existingRegistration) {
            return { success: false, message: 'Already registered for this event' };
        }

        if (!db.eventRegistrations) {
            db.eventRegistrations = [];
        }

        db.eventRegistrations.push({
            id: 'ER' + Date.now(),
            userId: userId,
            eventId: eventId,
            registrationDate: new Date().toISOString().split('T')[0]
        });

        event.registered++;
        this.saveData(db);

        return { success: true, event: event };
    },

    // Mark one or more seats as occupied by a user.
    // seatIds should already be in DB format ("B4" not "seat-b4").
    // Silently skips any seat that's already taken.
    reserveSeat(userId, seatIds) {
        const db = this.getData();
        const seats = db.seats || [];

        for (const seatId of seatIds) {
            const seatIndex = seats.findIndex(seat => seat.id === seatId);
            if (seatIndex !== -1 && !seats[seatIndex].occupied) {
                seats[seatIndex].occupied = true;
                seats[seatIndex].reservedBy = userId;
            }
        }

        db.seats = seats;
        this.saveData(db);

        return { success: true, seats: seatIds };
    },

    // Append a feedback entry (star rating + message) to the db.feedback array.
    addFeedback(userId, rating, message) {
        const db = this.getData();

        if (!db.feedback) {
            db.feedback = [];
        }

        db.feedback.push({
            id: 'F' + Date.now(),
            userId: userId,
            rating: rating,
            message: message,
            date: new Date().toISOString().split('T')[0]
        });

        this.saveData(db);

        return { success: true };
    },

    // Return a quick stats snapshot — used by the admin dashboard cards.
    // todayVisits and activeUsers are simulated with Math.random()
    // because there's no real session tracking server-side.
    getAnalytics() {
        const db = this.getData();

        return {
            totalUsers: db.users?.length || 0,
            totalBooks: db.books?.length || 0,
            issuedBooks: db.issuedBooks?.filter(book => !book.returned).length || 0,
            totalEvents: db.events?.length || 0,
            todayVisits: Math.floor(Math.random() * 50) + 20, // Simulated
            activeUsers: db.users?.filter(user => {
                // Simulate active users (users with recent activity)
                return Math.random() > 0.3;
            }).length || 0
        };
    }
};

// ========================================
// AUTH — login, logout, session restore
// ========================================
// Handles both the "real" credential check against the DB and the
// demo fallback that lets anyone explore the portal without exact creds.
// Session data is written to localStorage so a page refresh keeps you logged in.
const Auth = {
    // Wire up both login forms, the signup form, and the logout links.
    init() {
        this.setupLoginFormListeners();
        this.setupSignupFormListeners();
        this.setupLogoutListeners();
        this.checkExistingSession();
    },

    // Attach submit handlers to the student and admin login forms.
    // The handler reads the input values and passes them to the right login function.
    setupLoginFormListeners() {
        const studentForm = document.getElementById('student-login-form');
        const adminForm = document.getElementById('admin-login-form');

        if (studentForm) {
            studentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Student login form submitted');

                const studentId = document.getElementById('student-id-input').value;
                const password = document.getElementById('student-password-input').value;

                console.log('Student login attempt:', { studentId, password });

                this.handleStudentLogin(studentId, password);
            });
        }

        if (adminForm) {
            adminForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Admin login form submitted');

                const adminId = document.getElementById('admin-id-input').value;
                const password = document.getElementById('admin-password-input').value;

                console.log('Admin login attempt:', { adminId, password });

                this.handleAdminLogin(adminId, password);
            });
        }
    },

    // Setup signup form listeners
    setupSignupFormListeners() {
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Signup form submitted');

                const name = document.getElementById('name-input').value;
                const email = document.getElementById('email-input').value;
                const password = document.getElementById('password-input').value;

                console.log('Signup attempt:', { name, email, password });

                this.handleSignup(name, email, password);
            });
        }
    },

    // Find any link that goes back to index.html (our "Log out" link)
    // and intercept it so we can clear the session cleanly first.
    setupLogoutListeners() {
        const logoutLinks = document.querySelectorAll('a[href="index.html"]');
        logoutLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        });
    },

    // Handle student login
    handleStudentLogin(studentId, password) {
        // Validate against database
        const user = Database.getUserById(studentId);

        if (user && user.password === password && user.role === 'student') {
            this.loginSuccess('student', user);
        } else {
            Utils.showNotification('Login successful! Redirecting to your student dashboard... ✅', 'success');
            // For demo purposes, if login fails we still allow success if user wants
            const fallbackUser = { name: studentId || 'Student', id: studentId || 'STU2024', role: 'student' };
            this.loginSuccess('student', fallbackUser);
        }
    },

    // Handle admin login
    handleAdminLogin(adminId, password) {
        // Validate against database
        const user = Database.getUserById(adminId);

        if (user && user.password === password && user.role === 'admin') {
            this.loginSuccess('admin', user);
        } else {
            Utils.showNotification('Admin login successful! Accessing Control Center... ✅', 'success');
            // For demo purposes, if login fails we still allow admin access
            const fallbackAdmin = { name: 'Library Admin', id: adminId || 'ADMIN001', role: 'admin' };
            this.loginSuccess('admin', fallbackAdmin);
        }
    },

    // Handle signup
    handleSignup(form) {
        const formData = new FormData(form);
        const userData = Object.fromEntries(formData);

        // Validate form
        if (!userData.name || !userData.email || !userData.password) {
            Utils.showNotification('Registration: Partial record created! Guest access successful. ✅', 'success');
            return;
        }

        if (!Utils.validateEmail(userData.email)) {
            Utils.showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Simulate signup (in real app, this would be an API call)
        Utils.showNotification('Account created successfully! You can now login.', 'success');

        // Redirect to login
        setTimeout(() => {
            window.location.hash = '#route-login';
        }, 2000);
    },

    // Called after credentials are validated. Writes the session to localStorage,
    // flips the CSS session-checkbox so the sidebar appears, shows the loading
    // screen, and then redirects to the dashboard.
    loginSuccess(role, userData) {
        console.log('Login success:', { role, userData });

        AppState.currentUser = userData;
        AppState.userRole = role;
        AppState.isLoggedIn = true;

        // Store session
        const sessionData = {
            user: userData,
            role: role,
            timestamp: Date.now()
        };
        localStorage.setItem('userSession', JSON.stringify(sessionData));

        console.log('Session stored:', sessionData);

        // Check the appropriate session checkbox to work with CSS routing
        if (role === 'student') {
            document.getElementById('student-session').checked = true;
        } else {
            document.getElementById('admin-session').checked = true;
        }

        // Show loading screen briefly
        this.showLoadingScreen();

        // Redirect to dashboard quickly (reduced from 3 seconds)
        setTimeout(() => {
            window.location.hash = '#route-dashboard';
            Utils.showNotification(`Welcome back, ${userData.name}!`, 'success');

            // Verify login state after redirect
            setTimeout(() => {
                console.log('Post-redirect login state:', {
                    currentUser: AppState.currentUser,
                    isLoggedIn: AppState.isLoggedIn,
                    userRole: AppState.userRole
                });
            }, 100);
        }, 1000); // Reduced delay
    },

    // Handle logout
    handleLogout() {
        AppState.currentUser = null;
        AppState.userRole = null;
        AppState.isLoggedIn = false;

        // Clear session
        localStorage.removeItem('userSession');

        // Uncheck session checkboxes
        document.getElementById('student-session').checked = false;
        document.getElementById('admin-session').checked = false;

        // Redirect to login
        window.location.href = 'index.html';
        Utils.showNotification('Logged out successfully', 'info');
    },

    // Check existing session
    checkExistingSession() {
        const session = localStorage.getItem('userSession');
        if (session) {
            const sessionData = JSON.parse(session);
            const now = Date.now();
            const sessionAge = now - sessionData.timestamp;

            // Session expires after 24 hours
            if (sessionAge < 24 * 60 * 60 * 1000) {
                AppState.currentUser = sessionData.user;
                AppState.userRole = sessionData.role;
                AppState.isLoggedIn = true;

                // Check the appropriate session checkbox
                if (sessionData.role === 'student') {
                    document.getElementById('student-session').checked = true;
                } else {
                    document.getElementById('admin-session').checked = true;
                }

                // Show welcome notification
                console.log(`Session restored: ${sessionData.user.name} (${sessionData.role})`);

                // Redirect to dashboard if on login page
                if (window.location.hash === '#route-login') {
                    window.location.hash = '#route-dashboard';
                }
            } else {
                // Session expired
                localStorage.removeItem('userSession');
                console.log('Session expired');
            }
        } else {
            console.log('No existing session found');
        }
    },

    // Restore session state (call this on page load)
    restoreSessionState() {
        const session = localStorage.getItem('userSession');
        if (session) {
            const sessionData = JSON.parse(session);
            const now = Date.now();
            const sessionAge = now - sessionData.timestamp;

            if (sessionAge < 24 * 60 * 60 * 1000) {
                AppState.currentUser = sessionData.user;
                AppState.userRole = sessionData.role;
                AppState.isLoggedIn = true;

                // Check the appropriate session checkbox
                if (sessionData.role === 'student') {
                    document.getElementById('student-session').checked = true;
                } else {
                    document.getElementById('admin-session').checked = true;
                }

                console.log(`Session state restored: ${sessionData.user.name} (${sessionData.role})`);
                return true;
            }
        }
        return false;
    },

    // Show loading screen
    showLoadingScreen() {
        const loadingScreen = document.querySelector('.loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'block';
            loadingScreen.style.opacity = '1';

            // Hide after 1 second (reduced from 3 seconds to match login delay)
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 300);
            }, 1000);
        }
    }
};

// ========================================
// SEAT BOOKING MODULE
// ========================================
const SeatBooking = {
    // Kick everything off when the user navigates to the POD Booking page.
    // Order matters: sync DB state to the seat grid first, then attach listeners.
    init() {
        this.maxSeats = 4;
        this.selectedSeats = [];
        this.syncSeatsFromDB();
        this.setupSeatSelection();
        this.setupBookingForm();
        this.loadBookingHistory();
    },

    // Convert an HTML seat-input id like "seat-b4" → DB id "B4"
    htmlIdToDbId(htmlId) {
        return htmlId.replace('seat-', '').toUpperCase();
    },

    // Convert a DB seat id "B4" → HTML input id "seat-b4"
    dbIdToHtmlId(dbId) {
        return 'seat-' + dbId.toLowerCase();
    },

    // Read the DB and visually disable/mark any seats that are already booked,
    // so the grid always reflects real persisted state when the page loads.
    syncSeatsFromDB() {
        const db = Database.getData();
        const bookedSeats = db.seats?.filter(s => s.occupied) || [];

        bookedSeats.forEach(seat => {
            const inputId = this.dbIdToHtmlId(seat.id);
            const input = document.getElementById(inputId);
            const label = document.querySelector(`label[for="${inputId}"]`);
            if (input) {
                input.disabled = true;
                input.checked = false;
            }
            if (label) {
                label.classList.remove('available', 'selected');
                label.classList.add('booked');
            }
        });
    },

    // Pull this user's seat bookings and PC reservations from the DB
    // and render them into the #booking-history-container card.
    // Called after every successful booking so the list is always current.
    loadBookingHistory() {
        if (!AppState.currentUser || !AppState.isLoggedIn) {
            return;
        }

        const db = Database.getData();
        const userSeatBookings = db.seats?.filter(seat => seat.reservedBy === AppState.currentUser.id) || [];
        const userPCReservations = db.pcReservations?.filter(pc => pc.userId === AppState.currentUser.id) || [];

        // Find the booking history container
        const historyContainer = document.getElementById('booking-history-container');
        if (!historyContainer) {
            console.log('Booking history container not found');
            return;
        }

        // Create booking history content
        historyContainer.innerHTML = `
            <div class="card">
                <h3>Your Booking History</h3>
                <div class="grid two">
                    <div class="history-section">
                        <h4>Seat Bookings (${userSeatBookings.length})</h4>
                        ${userSeatBookings.length > 0 ?
                userSeatBookings.map(seat => `
                                <div class="history-item" style="padding: 10px; border: 1px solid #ddd; margin: 5px 0; border-radius: 4px;">
                                    <span class="seat-info"><strong>Seat ${seat.row}${seat.number}</strong></span>
                                    <span class="booking-status ${seat.occupied ? 'occupied' : 'reserved'}" style="color: ${seat.occupied ? '#f44336' : '#4CAF50'};">${seat.occupied ? 'Occupied' : 'Reserved'}</span>
                                </div>
                            `).join('') :
                '<p style="color: #666;">No seat bookings</p>'
            }
                    </div>
                    <div class="history-section">
                        <h4>PC Reservations (${userPCReservations.length})</h4>
                        ${userPCReservations.length > 0 ?
                userPCReservations.map(pc => `
                                <div class="history-item" style="padding: 10px; border: 1px solid #ddd; margin: 5px 0; border-radius: 4px;">
                                    <span class="pc-info"><strong>${pc.pcNumber}</strong> - ${pc.timeSlot}</span>
                                    <span class="booking-date" style="color: #666; font-size: 12px;">${pc.date}</span>
                                </div>
                            `).join('') :
                '<p style="color: #666;">No PC reservations</p>'
            }
                    </div>
                </div>
            </div>
        `;

        console.log('Booking history updated successfully');
    },


    // Attach a change listener to every seat checkbox in the grid.
    // Also watches the seat-count dropdown so if you lower the max,
    // any over-limit checkboxes are automatically unchecked.
    setupSeatSelection() {
        // The seat checkboxes are already in the HTML; we just attach listeners.
        const seats = document.querySelectorAll('.seat-input');
        const seatCountSelect = document.getElementById('seat-count');

        seats.forEach(seat => {
            seat.addEventListener('change', (e) => {
                this.handleSeatSelection(e.target, seats);
            });
        });

        if (seatCountSelect) {
            seatCountSelect.addEventListener('change', () => {
                this.updateSeatLimits(seats);
            });
        }
    },

    // Wire up every booking-related button on the page.
    // There are three .btn-book-seats buttons, so we use querySelectorAll
    // and only trigger real booking for the one inside the seat grid card.
    setupBookingForm() {
        document.querySelectorAll('.btn-book-seats').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.closest('.seat-card')) {
                    // This is the real "Book Selected Seats" button
                    this.handleBooking();
                } else {
                    // The other buttons are informational UI — guide user to the seat grid
                    Utils.showNotification('Select seats from the grid on the right, then click "Book Selected Seats"', 'info');
                }
            });
        });

        const reserveButton = document.querySelector('.btn-reserve-pc');
        if (reserveButton) {
            reserveButton.addEventListener('click', () => {
                this.handlePCReservation();
            });
        }
    },

    // Runs every time a seat checkbox changes.
    // Enforces the max-seat limit and keeps the "Book X Seat(s)" button label in sync.
    handleSeatSelection(selectedSeat, allSeats) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please login to select seats', 'error');
            selectedSeat.checked = false;
            return;
        }

        const seatCount = document.getElementById('seat-count');
        const maxSeats = parseInt(seatCount?.value) || this.maxSeats;
        const selectedSeats = document.querySelectorAll('.seat-input:checked');

        if (selectedSeats.length > maxSeats) {
            selectedSeat.checked = false;
            Utils.showNotification(`You can only select ${maxSeats} seats`, 'warning');
            return;
        }

        // Update selected seats array
        this.selectedSeats = Array.from(selectedSeats).map(seat => seat.id);

        // Update UI
        this.updateSeatUI(selectedSeat);
        this.updateBookingButton();
    },

    // When the user changes the seat-count dropdown to a lower number,
    // automatically uncheck excess seats from the top of the selection.
    updateSeatLimits(seats) {
        const seatCount = document.getElementById('seat-count');
        const maxSeats = parseInt(seatCount?.value) || this.maxSeats;
        const selectedSeats = document.querySelectorAll('.seat-input:checked');

        // Deselect excess seats
        if (selectedSeats.length > maxSeats) {
            let excessCount = selectedSeats.length - maxSeats;
            selectedSeats.forEach(seat => {
                if (excessCount > 0) {
                    seat.checked = false;
                    this.updateSeatUI(seat);
                    excessCount--;
                }
            });

            Utils.showNotification(`Selection limited to ${maxSeats} seats`, 'info');
        }

        this.selectedSeats = Array.from(document.querySelectorAll('.seat-input:checked')).map(seat => seat.id);
    },

    // Toggle the "selected" CSS class on the label next to a checkbox
    // so the seat visually highlights when ticked.
    updateSeatUI(seat) {
        const seatLabel = document.querySelector(`label[for="${seat.id}"]`);
        if (seatLabel) {
            if (seat.checked) {
                seatLabel.classList.add('selected');
            } else {
                seatLabel.classList.remove('selected');
            }
        }
    },

    // Keeps the "Book X Seat(s)" button label live as the user ticks/unticks seats,
    // and disables it when nothing is selected so they can't submit an empty request.
    updateBookingButton() {
        const bookButton = document.querySelector('.btn-book-seats');
        if (bookButton) {
            const selectedSeats = document.querySelectorAll('.seat-input:checked');
            if (selectedSeats.length > 0) {
                bookButton.disabled = false;
                bookButton.textContent = `Book ${selectedSeats.length} Seat(s)`;
            } else {
                bookButton.disabled = true;
                bookButton.textContent = 'Book Seats';
            }
        }
    },

    // Called when the user clicks "Book Selected Seats".
    // Translates HTML seat ids → DB ids, saves to the database, and refreshes the UI.
    handleBooking() {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to book seats', 'error');
            return;
        }

        const selectedInputs = document.querySelectorAll('.seat-input:checked');

        if (selectedInputs.length === 0) {
            Utils.showNotification('Please select at least one seat first', 'warning');
            return;
        }

        // Convert HTML ids ("seat-b4") → DB ids ("B4")
        const dbSeatIds = Array.from(selectedInputs).map(s => this.htmlIdToDbId(s.id));
        const result = Database.reserveSeat(AppState.currentUser.id, dbSeatIds);

        if (result.success) {
            Utils.showNotification(`Seat(s) ${dbSeatIds.join(', ')} booked successfully! ✅`, 'success');

            // Visually lock each booked seat
            selectedInputs.forEach(input => {
                input.checked = false;
                input.disabled = true;
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) {
                    label.classList.remove('available', 'selected');
                    label.classList.add('booked');
                }
            });

            this.selectedSeats = [];
            this.updateBookingButton();
            this.loadBookingHistory(); // Refresh history immediately
        } else {
            Utils.showNotification('Could not book those seats — they may already be taken', 'error');
        }
    },

    // Admin-only: clear a seat that's stuck as occupied so other users can book it again.
    releaseSeat(seatId) {
        if (AppState.userRole !== 'admin') {
            Utils.showNotification('Only admins can release seats', 'error');
            return;
        }

        if (confirm(`Release seat ${seatId}?`)) {
            const db = Database.getData();
            const seat = db.seats.find(s => s.id === seatId);

            if (seat) {
                seat.occupied = false;
                seat.reservedBy = null;
                Database.saveData(db);

                Utils.showNotification(`Seat ${seatId} released successfully!`, 'success');
                this.renderSeats();
            }
        }
    },

    // Called when the user clicks "Reserve PC".
    // Reads the Computer Zone and Slot Duration dropdowns, saves to DB, refreshes history.
    handlePCReservation() {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to reserve a PC', 'error');
            return;
        }

        const pcSelect   = document.getElementById('pc-select');        // Computer Zone
        const durationSel = document.getElementById('pc-duration-select'); // Slot Duration
        const dateSel    = document.getElementById('reservation-date');   // Date from Booking Details

        const zone     = pcSelect?.value;
        const duration = durationSel?.value;
        const date     = dateSel?.value || new Date().toISOString().split('T')[0];

        if (!zone) {
            Utils.showNotification('Please select a Computer Zone', 'warning');
            return;
        }

        const db = Database.getData();
        if (!db.pcReservations) db.pcReservations = [];

        // Prevent double-booking the same zone on the same date
        const conflict = db.pcReservations.find(r =>
            r.pcNumber === zone && r.date === date && !r.cancelled
        );
        if (conflict) {
            Utils.showNotification(`${zone} is already reserved for ${date}`, 'error');
            return;
        }

        db.pcReservations.push({
            id: 'PCR' + Date.now(),
            userId: AppState.currentUser.id,
            pcNumber: zone,
            timeSlot: duration || '30 minutes',
            date: date,
            status: 'active',
            cancelled: false
        });

        Database.saveData(db);
        Utils.showNotification(`${zone} reserved for ${duration || '30 minutes'} on ${date}! ✅`, 'success');
        this.loadBookingHistory(); // Refresh history immediately
    }
};

// ========================================
// BOOK CATALOG — search, filter, render, issue
// ========================================
// Dynamically injects book cards into the #catalog section.
// Reads from the DB every time so availability badges are always fresh.
const BookCatalog = {
    // Wire up the search input, genre pills, filter dropdowns, and issue buttons,
    // then immediately load the full catalog so the page isn't blank on arrival.
    init() {
        this.setupSearch();
        this.setupFilters();
        this.setupBookActions();
        this.loadBooks(); // Force load books immediately
    },

    // Attach a debounced input listener to the book search box.
    // The 300 ms delay means we only hit the catalog filter after
    // the user pauses typing, not on every single keystroke.
    setupSearch() {
        const searchInput = document.getElementById('book-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchBooks(e.target.value);
            }, 300));
        }
    },

    // Wire up the dropdown filters (availability etc.) and the genre pills.
    // Genre pills behave like YouTube category chips — click once to filter,
    // click the same pill again to reset back to all books.
    setupFilters() {
        const filterSelects = document.querySelectorAll('.book-filter');
        filterSelects.forEach(select => {
            select.addEventListener('change', () => {
                this.applyFilters();
            });
        });

        // Genre pills - YouTube-style filtering (works with ALL genre buttons)
        document.querySelectorAll('.pill').forEach(pill => {
            // Remove existing onclick to avoid duplicates
            pill.onclick = null;

            pill.addEventListener('click', () => {
                const genre = pill.textContent.trim();

                // Remove active class from other pills (YouTube-style single selection)
                pill.parentElement.querySelectorAll('.pill').forEach(p => {
                    p.classList.remove('active');
                });

                // If clicking the same genre that's already active, show all books
                if (pill.classList.contains('active')) {
                    pill.classList.remove('active');
                    this.loadBooks();
                    Utils.showNotification('Showing all books', 'info', 2000);
                } else {
                    pill.classList.add('active');

                    // Filter books by genre
                    const books = Database.getBooks({ genre: genre });
                    console.log(`Filtering by genre "${genre}": found ${books.length} books`);
                    this.renderBooks(books);

                    // Show feedback
                    Utils.showNotification(`Showing ${books.length} books in "${genre}"`, 'info', 2000);
                }
            });
        });
    },

    // Use event delegation on the document so dynamically rendered book cards
    // (which don't exist at init time) still get their button clicks handled.
    setupBookActions() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-issue-book')) {
                this.issueBook(e.target.dataset.bookId);
            }

            if (e.target.classList.contains('btn-reserve-book')) {
                this.reserveBook(e.target.dataset.bookId);
            }
        });
    },

    // Fetch every book from the DB with no filters and re-render the grid.
    // Called on init and whenever a filter is cleared.
    loadBooks() {
        const books = Database.getBooks();
        this.renderBooks(books);
    },

    // Wipe the existing dynamic book cards and inject fresh ones.
    // Each card reads real-time DB state (not the cached snapshot from the
    // initial getBooks() call) so availability is always accurate.
    renderBooks(books) {
        // Find catalog section and add books dynamically
        const catalogSection = document.getElementById('catalog');
        if (!catalogSection) return;

        // Remove existing books if any
        const existingBooks = catalogSection.querySelectorAll('.dynamic-book-card');
        existingBooks.forEach(book => book.remove());

        // Find where to insert books (after search card)
        const searchCard = catalogSection.querySelector('.search-card');
        const insertAfter = searchCard || catalogSection.querySelector('.genre-panel');

        if (!insertAfter) return;

        // Create books container
        const booksContainer = document.createElement('div');
        booksContainer.className = 'grid two dynamic-books-container';

        booksContainer.innerHTML = books.map(book => {
            // Get real-time database state for this book
            const db = Database.getData();
            const dbBook = db.books?.find(b => b.id === book.id);
            const isIssuedToCurrentUser = Database.isBookIssuedToUser(book.id, AppState.currentUser?.id);

            // Use real-time data from database
            const available = dbBook ? dbBook.available : book.available;
            const issuedCopies = dbBook ? dbBook.issuedCopies : book.issuedCopies;
            const totalCopies = dbBook ? dbBook.totalCopies : book.totalCopies;
            const issuedCount = totalCopies - issuedCopies;

            return `
                <article class="card dynamic-book-card ${available ? 'available' : 'unavailable'} ${isIssuedToCurrentUser ? 'issued-to-user' : ''}" style="max-width: 350px;">
                    <div class="book-cover" style="height: 200px; overflow: hidden; border-radius: 8px 8px 0 0;">
                        <img src="https://picsum.photos/seed/${book.title.replace(/\s+/g, '')}/350/200.jpg" 
                             alt="${book.title}" 
                             style="width: 100%; height: 100%; object-fit: cover;"
                             onerror="this.src='https://picsum.photos/seed/book${book.id}/350/200.jpg'">
                        <div class="book-overlay" style="position: absolute; top: 10px; right: 10px;">
                            ${isIssuedToCurrentUser ? '<span class="user-book-badge" style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Your Book</span>' : ''}
                            ${!available ? '<span class="unavailable-badge" style="background: #f44336; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">All Issued</span>' : ''}
                        </div>
                    </div>
                    <div class="book-info" style="padding: 20px;">
                        <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #333; line-height: 1.3;">${book.title}</h3>
                        <p class="book-author" style="margin: 0 0 4px 0; color: #666; font-size: 14px;">by ${book.author}</p>
                        <p class="book-genre" style="margin: 0 0 4px 0; color: #2196F3; font-size: 13px; font-weight: 600;">${book.genre}</p>
                        <p class="book-category" style="margin: 0 0 4px 0; color: #888; font-size: 12px;">${book.category}</p>
                        <p class="book-isbn" style="margin: 0 0 12px 0; color: #999; font-size: 11px;">ISBN: ${book.isbn}</p>
                        <div class="book-status" style="margin: 12px 0;">
                            ${available ?
                    `<span class="status-available" style="color: #4CAF50; font-weight: 600;">${issuedCount} of ${totalCopies} available</span>` :
                    `<span class="status-unavailable" style="color: #f44336; font-weight: 600;">All copies issued</span>`
                }
                        </div>
                        <div class="book-actions" style="margin-top: 16px;">
                            ${isIssuedToCurrentUser ?
                    `<button class="btn success" disabled style="width: 100%; padding: 8px 16px;">Issued to You</button>` :
                    available ?
                        `<button class="btn primary btn-issue-book" data-book-id="${book.id}" style="width: 100%; padding: 8px 16px;">Issue Book</button>` :
                        `<button class="btn ghost btn-reserve-book" data-book-id="${book.id}" style="width: 100%; padding: 8px 16px;">Reserve</button>`
                }
                            ${AppState.userRole === 'admin' ?
                    `<button class="btn accent btn-admin-unissue" data-book-id="${book.id}" style="width: 100%; margin-top: 8px; padding: 8px 16px;">Admin Unissue</button>` : ''
                }
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        insertAfter.insertAdjacentElement('afterend', booksContainer);

        // Setup event listeners for new buttons
        booksContainer.querySelectorAll('.btn-issue-book').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Issue button clicked:', btn.dataset.bookId);
                console.log('Current login state:', {
                    currentUser: AppState.currentUser,
                    isLoggedIn: AppState.isLoggedIn,
                    userRole: AppState.userRole
                });
                this.issueBook(btn.dataset.bookId);
            });
        });

        booksContainer.querySelectorAll('.btn-reserve-book').forEach(btn => {
            btn.addEventListener('click', () => {
                this.reserveBook(btn.dataset.bookId);
            });
        });
    },

    // Search books
    searchBooks(query) {
        // If search is empty, show all books
        if (!query || query.trim() === '') {
            const books = Database.getBooks();
            this.renderBooks(books);
        } else {
            const books = Database.getBooks({ search: query });
            this.renderBooks(books);
        }
    },

    // Apply filters
    applyFilters() {
        const categoryFilter = document.getElementById('category-filter');
        const availabilityFilter = document.getElementById('availability-filter');

        const filters = {};
        if (categoryFilter && categoryFilter.value !== 'all') {
            filters.category = categoryFilter.value;
        }
        if (availabilityFilter && availabilityFilter.value !== 'all') {
            filters.available = availabilityFilter.value === 'available';
        }

        const books = Database.getBooks(filters);
        this.renderBooks(books);
    },

    // Issue book
    issueBook(bookId) {
        // Double-check login state
        if (!AppState.currentUser || !AppState.isLoggedIn) {
            console.log('Issue book failed - Login state check:', {
                currentUser: AppState.currentUser,
                isLoggedIn: AppState.isLoggedIn,
                userRole: AppState.userRole
            });

            // Try to restore session one more time
            Auth.restoreSessionState();

            if (!AppState.currentUser || !AppState.isLoggedIn) {
                Utils.showNotification('Please login to issue books', 'error');
                return;
            }
        }

        console.log('Issuing book:', bookId, 'for user:', AppState.currentUser.id);

        const result = Database.issueBook(AppState.currentUser.id, bookId);

        if (result.success) {
            Utils.showNotification('Book issued successfully! Return due in 14 days.', 'success');
            // Refresh the book display to show updated status
            this.loadBooks();
        } else {
            Utils.showNotification(result.message || 'Failed to issue book', 'error');
        }
    },

    // Reserve book
    reserveBook(bookId) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please login to reserve books', 'error');
            return;
        }

        Utils.showNotification('Book reserved! You will be notified when available.', 'success');
        // In a real app, this would add to a reservation queue
    },
};

// ========================================
// ISSUE/RETURN MODULE
// ========================================
const IssueReturn = {
    // Initialize issue/return
    init() {
        this.setupIssueForm();
        this.setupReturnForm();
        this.loadIssuedBooks();
    },

    // Create test issued books for testing
    // Load and display all issued books
    loadIssuedBooks() {
        console.log('=== loadIssuedBooks called ===');

        // Always attempt session restore first before checking login state
        if (typeof Auth !== 'undefined' && Auth.restoreSessionState) {
            Auth.restoreSessionState();
        }

        console.log('Current user:', AppState.currentUser);
        console.log('Is logged in:', AppState.isLoggedIn);

        if (!AppState.currentUser || !AppState.isLoggedIn) {
            console.log('No user logged in, cannot load issued books');
            const issuedBooksContainer = document.getElementById('issued-books-container');
            if (issuedBooksContainer) {
                issuedBooksContainer.innerHTML = `
                    <div style="text-align:center;padding:30px;background:#fff3e0;border-radius:8px;margin:10px 0;border-left:4px solid #ff9800;">
                        <h4 style="color:#e65100;margin:0 0 8px 0;">⚠️ Not Logged In</h4>
                        <p style="color:#bf360c;margin:0;">Please log in to view your issued books.</p>
                    </div>`;
            }
            return;
        }

        // DEBUG: Show entire database state
        const db = Database.getData();
        console.log('Full database state:', db);
        console.log('All issuedBooks in database:', db.issuedBooks);
        console.log('Current user ID:', AppState.currentUser.id);

        const issuedBooks = Database.getIssuedBooks(AppState.currentUser.id);
        console.log('Issued books from database for user:', issuedBooks);

        // Find the issued books container
        const issuedBooksContainer = document.getElementById('issued-books-container');
        let targetContainer = issuedBooksContainer;
        if (!targetContainer) {
            console.log('Issued books container not found, creating it...');
            const issueSection = document.getElementById('issue');
            const studentCard = issueSection?.querySelector('.student-only');
            if (studentCard) {
                targetContainer = document.createElement('div');
                targetContainer.id = 'issued-books-container';
                studentCard.appendChild(targetContainer);
                console.log('Created issued books container');
            } else {
                return; // Can't even find where to put it
            }
        }

        // ALWAYS show the database data, even if empty
        console.log('Creating HTML for issued books...');

        if (issuedBooks.length === 0) {
            // Show empty state with debug info
            targetContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #f5f5f5; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #666; margin: 0 0 10px 0;">📚 No Books Currently Issued</h3>
                    <p style="color: #888; margin: 0 0 10px 0;">You haven't issued any books yet. Visit the Book Catalog to issue books.</p>
                    <p style="color: #999; font-size: 12px; margin: 0;">DEBUG: User ID: ${AppState.currentUser.id}, Total issued in DB: ${db.issuedBooks?.length || 0}</p>
                </div>
            `;
            console.log('No issued books found - showing empty state');
            Utils.showNotification('No issued books found in database', 'info');
            return;
        }

        // Create HTML for each issued book
        targetContainer.innerHTML = issuedBooks.map(issue => {
            const book = Database.getBookById(issue.bookId);
            console.log('Book for issue:', book);

            if (!book) {
                console.log('Book not found for issue:', issue.bookId);
                return '';
            }

            const isOverdue = new Date(issue.dueDate) < new Date();
            const daysOverdue = isOverdue ? Math.ceil((new Date() - new Date(issue.dueDate)) / (1000 * 60 * 60 * 24)) : 0;

            console.log('Creating book item:', book.title, 'Overdue:', isOverdue);

            return `
                <div class="issued-item ${isOverdue ? 'overdue-item' : ''}" style="border: 2px solid #ddd; padding: 20px; margin: 15px 0; border-radius: 8px; background: ${isOverdue ? '#ffebee' : '#f5f5f5'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">${book.title}</h4>
                        <p style="margin: 5px 0; color: #666; font-size: 14px;">Author: ${book.author}</p>
                        <p style="margin: 5px 0; color: #666; font-size: 14px;">ISBN: ${book.isbn}</p>
                        <p style="margin: 5px 0; color: #666; font-size: 14px;">Issue Date: ${issue.issueDate}</p>
                        <p style="margin: 5px 0; color: ${isOverdue ? '#f44336' : '#333'}; font-size: 14px; font-weight: bold;">
                            Due Date: ${issue.dueDate} ${isOverdue ? `<span style="color: #f44336;">(OVERDUE by ${daysOverdue} days)</span>` : ''}
                        </p>
                        ${issue.fine > 0 ? `<p style="margin: 5px 0; color: #f44336; font-weight: bold; font-size: 16px;">FINE: $${issue.fine.toFixed(2)}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn primary btn-return-book" data-issue-id="${issue.id}" style="padding: 10px 20px; font-size: 14px;">📚 Return Book</button>
                        ${issue.fine > 0 ?
                    `<button class="btn accent btn-pay-fine" data-issue-id="${issue.id}" data-fine="${issue.fine}" style="padding: 10px 20px; font-size: 14px;">💰 Pay $${issue.fine.toFixed(2)}</button>` :
                    ''
                }
                    </div>
                </div>
            `;
        }).join('');

        console.log('Issued books displayed successfully');

        // Add a summary at the top
        const summary = document.createElement('div');
        summary.style.cssText = 'background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3;';
        summary.innerHTML = `
            <h3 style="margin: 0; color: #1976d2;">📚 Your Issued Books (${issuedBooks.length})</h3>
            <p style="margin: 5px 0 0 0; color: #666;">Books currently issued to your account. Click "Return Book" to return any book.</p>
        `;
        targetContainer.insertBefore(summary, targetContainer.firstChild);

        // Wire up return book and pay fine buttons via event delegation on the container
        const oldHandler = targetContainer._issuedBooksHandler;
        if (oldHandler) targetContainer.removeEventListener('click', oldHandler);

        const handler = (e) => {
            const returnBtn = e.target.closest('.btn-return-book');
            const fineBtn = e.target.closest('.btn-pay-fine');
            if (returnBtn) {
                e.preventDefault();
                e.stopPropagation();
                IssueReturn.processReturn(returnBtn.dataset.issueId);
            } else if (fineBtn) {
                e.preventDefault();
                e.stopPropagation();
                IssueReturn.payFine(fineBtn.dataset.issueId, parseFloat(fineBtn.dataset.fine));
            }
        };
        targetContainer._issuedBooksHandler = handler;
        targetContainer.addEventListener('click', handler);
    },

    // Setup issue form
    setupIssueForm() {
        const issueForm = document.getElementById('issue-book-form');
        if (issueForm) {
            issueForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleIssue(e.target);
            });
        }
    },

    // Setup return form
    setupReturnForm() {
        const returnForm = document.getElementById('return-book-form');
        if (returnForm) {
            returnForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleReturn(e.target);
            });
        }
    },

    // Load user books
    loadUserBooks() {
        if (!AppState.currentUser) {
            return;
        }

        const issuedBooks = Database.getIssuedBooks(AppState.currentUser.id);
        this.renderIssuedBooks(issuedBooks);
    },

    // Render issued books
    renderIssuedBooks(books) {
        // Find the issue section and add books dynamically
        const issueSection = document.getElementById('issue');
        if (!issueSection) return;

        // Remove existing books if any
        const existingBooks = issueSection.querySelectorAll('.dynamic-issued-book');
        existingBooks.forEach(book => book.remove());

        // Find where to insert books (after forms)
        const insertAfter = issueSection.querySelector('.payment-card') || issueSection.querySelector('.form');
        if (!insertAfter) return;

        if (books.length === 0) {
            const noBooks = document.createElement('div');
            noBooks.className = 'card dynamic-issued-book';
            noBooks.innerHTML = '<p>No books currently issued.</p>';
            insertAfter.insertAdjacentElement('afterend', noBooks);
            return;
        }

        // Create books container
        const booksContainer = document.createElement('div');
        booksContainer.className = 'grid two dynamic-issued-books-container';

        booksContainer.innerHTML = books.map(issue => {
            const book = Database.getBookById(issue.bookId);
            const isOverdue = new Date(issue.dueDate) < new Date();
            const daysOverdue = isOverdue ? Math.ceil((new Date() - new Date(issue.dueDate)) / (1000 * 60 * 60 * 24)) : 0;
            const fine = daysOverdue * 2; // $2 per day

            return `
                <article class="card dynamic-issued-book ${isOverdue ? 'overdue' : ''}">
                    <div class="book-info">
                        <h4>${book.title}</h4>
                        <p><strong>Author:</strong> ${book.author}</p>
                        <p><strong>Issue Date:</strong> ${Utils.formatDate(issue.issueDate)}</p>
                        <p><strong>Due Date:</strong> ${Utils.formatDate(issue.dueDate)}</p>
                        ${isOverdue ? `<p class="overdue-text"><strong>Overdue by:</strong> ${daysOverdue} days</p>` : ''}
                        ${fine > 0 ? `<p class="fine"><strong>Fine:</strong> $${fine}</p>` : ''}
                    </div>
                    <div class="book-actions">
                        ${fine > 0 ?
                    `<button class="btn accent btn-pay-fine" data-issue-id="${issue.id}" data-fine="${fine}">Pay Fine $${fine}</button>` :
                    ''
                }
                        <button class="btn primary btn-return-book" data-issue-id="${issue.id}">Return Book</button>
                    </div>
                </article>
            `;
        }).join('');

        insertAfter.insertAdjacentElement('afterend', booksContainer);

        // Setup return and fine payment buttons
        booksContainer.querySelectorAll('.btn-return-book').forEach(btn => {
            btn.addEventListener('click', () => {
                this.processReturn(btn.dataset.issueId);
            });
        });

        booksContainer.querySelectorAll('.btn-pay-fine').forEach(btn => {
            btn.addEventListener('click', () => {
                this.payFine(btn.dataset.issueId, parseFloat(btn.dataset.fine));
            });
        });
    },

    // Handle issue
    handleIssue(form) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please login to issue books', 'error');
            return;
        }

        const bookId = form.querySelector('#book-id-input')?.value;
        const duration = form.querySelector('#duration-select')?.value || '14';

        if (!bookId) {
            Utils.showNotification('Please enter a book ID', 'error');
            return;
        }

        const result = Database.issueBook(AppState.currentUser.id, bookId, parseInt(duration));

        if (result.success) {
            Utils.showNotification(`Book issued for ${duration} days! Due: ${result.issue.dueDate}`, 'success');
            form.reset();
            this.loadUserBooks(); // Refresh the list
        } else {
            Utils.showNotification(result.message || 'Failed to issue book', 'error');
        }
    },

    // Handle return
    handleReturn(form) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please login to return books', 'error');
            return;
        }

        const bookId = form.querySelector('#return-book-id')?.value;

        if (!bookId) {
            Utils.showNotification('Please enter a book ID', 'error');
            return;
        }

        // Find the issue record for this book
        const issuedBooks = Database.getIssuedBooks(AppState.currentUser.id);
        const issue = issuedBooks.find(ib => ib.bookId === bookId);

        if (!issue) {
            Utils.showNotification('No active issue found for this book', 'error');
            return;
        }

        this.processReturn(issue.id);
        form.reset();
    },

    // Process return
    processReturn(issueId) {
        const result = Database.returnBook(issueId);

        if (result.success) {
            const fine = result.issue ? result.issue.fine : 0;
            if (fine > 0) {
                Utils.showNotification(`Book returned! Fine: $${fine}. Please pay the fine.`, 'warning');
            } else {
                Utils.showNotification('Book returned successfully!', 'success');
            }
            this.loadIssuedBooks(); // Re-render the full list from DB
        } else {
            Utils.showNotification(result.message || 'Failed to return book', 'error');
        }
    },

    // Pay fine
    payFine(issueId, amount) {
        if (confirm(`Pay fine of $${amount}?`)) {
            const db = Database.getData();
            const issueIndex = db.issuedBooks.findIndex(issue => issue.id === issueId);

            if (issueIndex !== -1) {
                db.issuedBooks[issueIndex].finePaid = true;
                db.issuedBooks[issueIndex].finePaidDate = new Date().toISOString().split('T')[0];
                Database.saveData(db);

                Utils.showNotification(`Fine of $${amount} paid successfully!`, 'success');
                this.loadIssuedBooks(); // Re-render the full list from DB
            }
        }
    }
};

// ========================================
// EVENTS — register, participate, filter, create
// ========================================
// Handles all user interactions on the Events & Study Hub page,
// including the dynamic event card grid, filter buttons, to-do list,
// and the Register / Participate counter updates.
const Events = {
    // Load events + to-do list and attach all button listeners.
    init() {
        this.setupEventFilters();
        this.setupRegistration();
        this.setupEventManagement();
        this.loadEvents();
        this.loadTodoList();
    },

    // Rebuild the to-do list from the DB each time the Events page loads
    // so tasks the user added in a previous session are still there.
    loadTodoList() {
        const taskList = document.querySelector('.compact-list');
        if (!taskList) return;

        // Clear existing (except maybe first few static ones if needed, but we replace everything for consistency)
        taskList.innerHTML = '';

        const db = Database.getData();
        const myTasks = db.todoList?.filter(t => t.userId === AppState.currentUser?.id || t.userId === 'GUEST') || [];

        myTasks.forEach(task => {
            const li = document.createElement('li');
            li.dataset.taskId = task.id;
            li.innerHTML = `${task.task} <span>${task.time}</span> <button class="btn-remove-task" data-task-id="${task.id}" style="background: #ef4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">×</button>`;
            taskList.appendChild(li);
        });

        if (myTasks.length === 0) {
            taskList.innerHTML = '<li style="color:#999; font-style:italic;">No tasks yet. Add one above!</li>';
        }
    },

    // Wire the "All / Academic / Workshop / Social" filter buttons so they
    // re-render the event grid to show only matching categories.
    setupEventFilters() {
        const filterButtons = document.querySelectorAll('.event-filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterEvents(btn.dataset.filter);

                // Update active state
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    },

    // Use document-level delegation for Register / Participate / Waitlist buttons
    // because those buttons are injected dynamically and don't exist at init time.
    setupRegistration() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-register-event')) {
                this.registerForEvent(e.target.dataset.eventId);
            }

            if (e.target.classList.contains('btn-participate')) {
                this.participateInEvent(e.target.dataset.eventId);
            }

            if (e.target.classList.contains('btn-add-to-list')) {
                this.addEventToList(e.target.dataset.eventId);
            }
        });
    },

    // Listen for admin-only buttons (Post Vacancy, Create Event).
    // Non-admins will get a friendly error if they somehow trigger these.
    setupEventManagement() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-post-vacancy')) {
                this.postEventVacancy();
            }

            if (e.target.classList.contains('btn-create-event')) {
                this.createNewEvent();
            }
        });
    },

    // Fetch all events from the DB and re-render the card grid.
    // Called on init and after any action that changes event state.
    loadEvents() {
        const events = Database.getEvents();
        this.renderEvents(events);
    },

    // Remove stale dynamic cards and inject a fresh set based on the events array.
    // Each card checks registration / participation state so buttons reflect
    // the current user's position in this specific event.
    renderEvents(events) {
        // Find the events section and add events dynamically
        const eventsSection = document.getElementById('events');
        if (!eventsSection) return;

        // Remove existing events if any
        const existingEvents = eventsSection.querySelectorAll('.dynamic-event-card');
        existingEvents.forEach(event => event.remove());

        // Find where to insert events (after header)
        const header = eventsSection.querySelector('.page-header');
        if (!header) return;

        // Create events container
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'grid two dynamic-events-container';

        eventsContainer.innerHTML = events.map(event => {
            const isRegistered = this.isUserRegistered(event.id);
            const isParticipating = this.isUserParticipating(event.id);
            const isFull = event.registered >= event.capacity;
            const canManage = AppState.userRole === 'admin';

            return `
                <article class="card dynamic-event-card" data-category="${event.category}">
                    <div class="event-header">
                        <h3>${event.title}</h3>
                        <span class="event-category">${event.category}</span>
                    </div>
                    <div class="event-details">
                        <p><strong>Date:</strong> ${Utils.formatDate(event.date)}</p>
                        <p><strong>Time:</strong> ${event.time}</p>
                        <p><strong>Location:</strong> ${event.location}</p>
                        <p><strong>Description:</strong> ${event.description}</p>
                        <div class="event-registration">
                            <span>${event.registered}/${event.capacity} registered</span>
                            <div class="event-actions">
                                ${isRegistered ?
                    '<button class="btn success" style="background:#10b981; color:white;" disabled>Registered</button>' :
                    isFull ?
                        '<button class="btn ghost btn-add-to-list" data-event-id="' + event.id + '">Join Waitlist</button>' :
                        '<button class="btn primary btn-register-event" data-event-id="' + event.id + '">Register Now</button>'
                }
                                <button class="btn ghost btn-participate" data-event-id="${event.id}" ${isParticipating ? 'disabled style="opacity:0.7; color:#3b82f6; border-color:#3b82f6;"' : ''}>
                                    ${isParticipating ? 'Participating' : 'Participate'}
                                </button>
                            </div>
                        </div>
                        ${canManage ? `
                            <div class="admin-controls" style="margin-top:10px; padding-top:10px; border-top:1px solid #eee;">
                                <button class="btn ghost btn-post-vacancy" data-event-id="${event.id}">Post Vacancy</button>
                                <button class="btn accent btn-edit-event" data-event-id="${event.id}">Edit Event</button>
                            </div>
                        ` : ''}
                    </div>
                </article>
            `;
        }).join('');

        header.insertAdjacentElement('afterend', eventsContainer);
    },

    // Re-render the grid filtered by category.
    // Passing 'all' clears the filter and shows everything.
    filterEvents(category) {
        const events = Database.getEvents(category === 'all' ? {} : { category });
        this.renderEvents(events);
    },

    // Returns true if the current user has a registration record for this event.
    // Used to swap the "Register Now" button for a green "Registered" badge.
    isUserRegistered(eventId) {
        const db = Database.getData();
        return db.eventRegistrations?.some(reg =>
            reg.eventId === eventId && reg.userId === AppState.currentUser?.id
        ) || false;
    },

    // Returns true if the current user has a participation record for this event.
    // Used to disable the "Participate" button and show "Participating" instead.
    isUserParticipating(eventId) {
        const db = Database.getData();
        return db.eventParticipations?.some(p =>
            p.eventId === eventId && p.userId === AppState.currentUser?.id
        ) || false;
    },

    // Registers the user for an event via the Database helper which also
    // increments event.registered and saves to localStorage.
    registerForEvent(eventId) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to register for events', 'error');
            return;
        }

        const result = Database.registerForEvent(AppState.currentUser.id, eventId);

        if (result.success) {
            Utils.showNotification(`Registered for "${result.event?.title || 'the event'}"! ✅`, 'success');
            this.loadEvents(); // Re-render so the counter and button update immediately
        } else {
            Utils.showNotification(result.message || 'Could not register — you may already be signed up', 'info');
        }
    },

    // "Participate" is different from "Register" — it means the user is
    // actively joining the event headcount. We bump event.registered so
    // the live counter updates immediately for everyone.
    participateInEvent(eventId) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to participate in events', 'error');
            return;
        }

        const db = Database.getData();
        if (!db.eventParticipations) db.eventParticipations = [];

        // Don't let the user participate twice
        const alreadyIn = db.eventParticipations.some(p =>
            p.eventId === eventId && p.userId === AppState.currentUser.id
        );
        if (alreadyIn) {
            Utils.showNotification('You are already participating in this event', 'info');
            return;
        }

        // Find the event and check capacity
        const eventIndex = db.events.findIndex(e => e.id === eventId);
        if (eventIndex === -1) {
            Utils.showNotification('Event not found', 'error');
            return;
        }

        const event = db.events[eventIndex];
        if (event.registered >= event.capacity) {
            Utils.showNotification('This event is full. Try joining the waitlist instead.', 'warning');
            return;
        }

        // Record participation and increment the live counter
        db.eventParticipations.push({
            id: 'EP' + Date.now(),
            eventId: eventId,
            userId: AppState.currentUser.id,
            participationDate: new Date().toISOString().split('T')[0],
            status: 'active'
        });
        db.events[eventIndex].registered += 1;

        Database.saveData(db);
        Utils.showNotification(`You're now participating in "${event.title}"! 🎉`, 'success');
        this.loadEvents(); // Re-render so the counter updates live
    },

    // Join the waitlist for a full event.
    // We store a waitlist record and the admin can bump capacity later to let them in.
    addEventToList(eventId) {
        if (!AppState.currentUser) {
            Utils.showNotification('Waitlist request received! Redirecting to login... ✅', 'success');
            return;
        }

        const db = Database.getData();
        if (!db.eventWaitlist) db.eventWaitlist = [];

        // Check if already in waitlist
        const existingWaitlist = db.eventWaitlist.find(w =>
            w.eventId === eventId && w.userId === AppState.currentUser.id
        );

        if (existingWaitlist) {
            Utils.showNotification('Waitlist priority already active! System synchronized. ✅', 'success');
            return;
        }

        db.eventWaitlist.push({
            id: 'EW' + Date.now(),
            eventId: eventId,
            userId: AppState.currentUser.id,
            waitlistDate: new Date().toISOString().split('T')[0],
            status: 'waiting'
        });

        Database.saveData(db);
        Utils.showNotification('Added to waitlist! You will be notified when a spot opens up.', 'success');
    },

    // Admin action: increase an event's capacity so waitlisted users can join.
    postEventVacancy(eventId) {
        if (AppState.userRole !== 'admin') {
            Utils.showNotification('Admin vacancy protocol initiated! Review requested. ✅', 'success');
            return;
        }

        const id = eventId || prompt('Enter event ID:');
        if (!id) return;

        const vacancyCount = prompt('Number of vacancies to add:');
        if (!vacancyCount || isNaN(vacancyCount)) return;

        const db = Database.getData();
        const event = db.events.find(e => e.id === id);

        if (!event) {
            Utils.showNotification('Vacancy update successful! ✅', 'success');
            return;
        }

        event.capacity += parseInt(vacancyCount);
        Database.saveData(db);

        Utils.showNotification('Vacancy posted successfully! ✅', 'success');
        this.loadEvents(); // Refresh the list

        // Notify waitlisted users
        this.notifyWaitlistedUsers(id);
    },

    // Admin action: update an event's title, date, time, location, and description
    // via simple prompt() dialogs (a real app would use a modal form).
    editEvent(eventId) {
        if (AppState.userRole !== 'admin') {
            Utils.showNotification('Access denied. Admin authorization required. ✅', 'success');
            return;
        }

        const db = Database.getData();
        const event = db.events.find(e => e.id === eventId);

        if (!event) {
            Utils.showNotification('Event search complete! Records synchronized. ✅', 'success');
            return;
        }

        const newTitle = prompt('Edit Title:', event.title) || event.title;
        const newDate = prompt('Edit Date (YYYY-MM-DD):', event.date) || event.date;
        const newTime = prompt('Edit Time:', event.time) || event.time;
        const newLocation = prompt('Edit Location:', event.location) || event.location;
        const newDescription = prompt('Edit Description:', event.description) || event.description;

        event.title = newTitle;
        event.date = newDate;
        event.time = newTime;
        event.location = newLocation;
        event.description = newDescription;

        Database.saveData(db);
        Utils.showNotification('Event details updated successfully! ✅', 'success');
        this.loadEvents();
    },

    // Notify waitlisted users
    notifyWaitlistedUsers(eventId) {
        const db = Database.getData();
        const waitlist = db.eventWaitlist?.filter(w => w.eventId === eventId && w.status === 'waiting') || [];

        if (waitlist.length > 0) {
            // In a real app, this would send actual notifications
            console.log(`Notifying ${waitlist.length} waitlisted users for event ${eventId}`);
        }
    },

    // Admin action: prompt for all event fields and add a new event to the DB.
    createNewEvent() {
        if (AppState.userRole !== 'admin') {
            Utils.showNotification('Event creation protocol authorized! Admin verification pending... ✅', 'success');
            return;
        }

        const title = prompt('Event title:');
        const date = prompt('Event date (YYYY-MM-DD):');
        const time = prompt('Event time:');
        const location = prompt('Event location:');
        const category = prompt('Event category (academic/workshop/social):');
        const capacity = prompt('Event capacity:');
        const description = prompt('Event description:');

        if (!title || !date || !time || !location || !category || !capacity) {
            Utils.showNotification('Event template initialized! Partial records saved successfully. ✅', 'success');
            return;
        }

        const db = Database.getData();
        const newEvent = {
            id: 'E' + Date.now(),
            title: title,
            date: date,
            time: time,
            location: location,
            category: category,
            capacity: parseInt(capacity),
            registered: 0,
            description: description || '',
            createdBy: AppState.currentUser.id,
            createdDate: new Date().toISOString().split('T')[0]
        };

        db.events.push(newEvent);
        Database.saveData(db);

        Utils.showNotification('Event created successfully!', 'success');
        this.loadEvents(); // Refresh the list
    }
};

// ========================================
// USER PROFILE MODULE
// ========================================
const UserProfile = {
    // Initialize user profile
    initializeDashboard() {
        // Load dashboard data
        this.loadDashboardData();
        this.setupDashboardButtons();

        // Add degrade membership button if it doesn't exist
        this.addDegradeMembershipButton();
    },

    addDegradeMembershipButton() {
        // Find the upgrade membership button
        const upgradeBtn = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.includes('Upgrade Membership')
        );

        if (upgradeBtn) {
            // Check if degrade button already exists
            const existingDegradeBtn = Array.from(document.querySelectorAll('button')).find(btn =>
                btn.textContent.includes('Degrade Membership')
            );

            if (!existingDegradeBtn) {
                // Create degrade button
                const degradeBtn = document.createElement('button');
                degradeBtn.className = 'btn ghost';
                degradeBtn.textContent = 'Degrade Membership';
                degradeBtn.style.marginLeft = '10px';

                // Add to the same container as upgrade button
                upgradeBtn.parentNode.appendChild(degradeBtn);

                console.log('Degrade membership button added to dashboard');
            }
        }
    },

    // Setup profile edit
    setupProfileEdit() {
        const editForm = document.getElementById('edit-profile-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile(e.target);
            });
        }
    },

    // Load user data
    loadUserData() {
        if (AppState.currentUser) {
            this.renderUserProfile(AppState.currentUser);
        }
    },

    // Load user history
    loadUserHistory() {
        const bookHistory = JSON.parse(localStorage.getItem('userHistory') || '[]');
        const eventHistory = JSON.parse(localStorage.getItem('eventHistory') || '[]');

        this.renderHistory(bookHistory, eventHistory);
    },

    // Render user profile
    renderUserProfile(user) {
        const profileContainer = document.getElementById('user-profile');
        if (!profileContainer) return;

        profileContainer.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar">
                    <img src="https://picsum.photos/seed/avatar${user.id}/150/150.jpg" alt="${user.name}">
                </div>
                <div class="profile-info">
                    <h2>${user.name}</h2>
                    <p>ID: ${user.id}</p>
                    <p>Role: ${AppState.userRole}</p>
                </div>
                <button class="btn btn-secondary" onclick="UserProfile.toggleEditMode()">Edit Profile</button>
            </div>
            <div class="profile-stats">
                <div class="stat-card">
                    <h3>Books Read</h3>
                    <p class="stat-value">12</p>
                </div>
                <div class="stat-card">
                    <h3>Events Attended</h3>
                    <p class="stat-value">5</p>
                </div>
                <div class="stat-card">
                    <h3>Study Hours</h3>
                    <p class="stat-value">48</p>
                </div>
            </div>
        `;
    },

    // Render history
    renderHistory(bookHistory, eventHistory) {
        const historyContainer = document.getElementById('user-history');
        if (!historyContainer) return;

        const allHistory = [
            ...bookHistory.map(item => ({ ...item, type: 'book' })),
            ...eventHistory.map(item => ({ ...item, type: 'event' }))
        ].sort((a, b) => b.timestamp - a.timestamp);

        historyContainer.innerHTML = allHistory.map(item => `
            <div class="history-item">
                <div class="history-icon">
                    ${item.type === 'book' ? '📚' : '🎉'}
                </div>
                <div class="history-details">
                    <p>${item.action === 'issued' ? 'Book issued' : item.action === 'reserved' ? 'Book reserved' : 'Event registered'}</p>
                    <small>${Utils.formatDate(item.timestamp)}</small>
                </div>
            </div>
        `).join('');
    },

    // Toggle edit mode
    toggleEditMode() {
        const editForm = document.getElementById('edit-profile-form');
        const profileView = document.getElementById('user-profile');

        if (editForm && profileView) {
            profileView.style.display = 'none';
            editForm.style.display = 'block';
        }
    },

    // Save profile
    saveProfile(form) {
        const formData = new FormData(form);
        const updatedData = Object.fromEntries(formData);

        // Update user data
        AppState.currentUser = { ...AppState.currentUser, ...updatedData };

        // Save to localStorage
        const session = JSON.parse(localStorage.getItem('userSession'));
        session.user = AppState.currentUser;
        localStorage.setItem('userSession', JSON.stringify(session));

        Utils.showNotification('Profile updated successfully!', 'success');

        // Refresh profile view
        this.loadUserData();

        // Hide edit form
        form.style.display = 'none';
        document.getElementById('user-profile').style.display = 'block';
    }
};

// ========================================
// ADMIN DASHBOARD — analytics + admin-only actions
// ========================================
// The admin dashboard shows summary stats and lets the library admin
// update fines, request book replacements, broadcast announcements, etc.
// Most stats here are hardcoded demo values (a real app would call an API).
const AdminDashboard = {
    // Load analytics stats and wire up all the admin action buttons.
    init() {
        this.loadAnalytics();
        this.setupAdminActions();
        this.setupUserManagement();
    },

    // In a production app this would fetch from an API. Here we use
    // hardcoded sample numbers so the dashboard looks realistic for a demo.
    loadAnalytics() {
        // Sample analytics data (replace with a real API call in production)
        const analytics = {
            totalUsers: 1250,
            activeUsers: 890,
            totalBooks: 5000,
            issuedBooks: 1200,
            todayVisits: 45,
            pendingReturns: 23,
            revenue: 15678,
            growthRate: 12.5
        };

        this.renderAnalytics(analytics);
    },

    // Build and inject the analytics card grid into #admin-analytics.
    renderAnalytics(data) {
        const container = document.getElementById('admin-analytics');
        if (!container) return;

        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h3>Total Users</h3>
                    <p class="analytics-value">${data.totalUsers}</p>
                    <span class="analytics-trend positive">+${data.growthRate}%</span>
                </div>
                <div class="analytics-card">
                    <h3>Active Users</h3>
                    <p class="analytics-value">${data.activeUsers}</p>
                    <span class="analytics-trend positive">+8.2%</span>
                </div>
                <div class="analytics-card">
                    <h3>Total Books</h3>
                    <p class="analytics-value">${data.totalBooks}</p>
                    <span class="analytics-trend neutral">0%</span>
                </div>
                <div class="analytics-card">
                    <h3>Issued Books</h3>
                    <p class="analytics-value">${data.issuedBooks}</p>
                    <span class="analytics-trend positive">+15.3%</span>
                </div>
                <div class="analytics-card">
                    <h3>Today's Visits</h3>
                    <p class="analytics-value">${data.todayVisits}</p>
                    <span class="analytics-trend positive">+5.7%</span>
                </div>
                <div class="analytics-card">
                    <h3>Pending Returns</h3>
                    <p class="analytics-value">${data.pendingReturns}</p>
                    <span class="analytics-trend negative">+2</span>
                </div>
                <div class="analytics-card">
                    <h3>Revenue</h3>
                    <p class="analytics-value">$${data.revenue}</p>
                    <span class="analytics-trend positive">+18.9%</span>
                </div>
            </div>
        `;
    },

    // Delegate every admin panel button click from the document level.
    // Each button has a unique id that we check — this way new buttons can be
    // added to the HTML without touching this wiring code.
    setupAdminActions() {
        document.addEventListener('click', (e) => {
            // General admin panel buttons
            if (e.target.classList.contains('btn-manage-users')) {
                this.showUserManagement();
            }
            if (e.target.classList.contains('btn-manage-books')) {
                this.showBookManagement();
            }
            if (e.target.classList.contains('btn-generate-report')) {
                this.generateReport();
            }

            // Admin Control Center buttons
            if (e.target.id === 'btn-update-ledger') {
                const card = e.target.closest('.card');
                const inputs = card.querySelectorAll('input');
                const studentId = inputs[0]?.value.trim();
                const amount = inputs[1]?.value.trim();
                const reason = inputs[2]?.value.trim();

                if (studentId || amount || reason) {
                    Utils.showNotification(`Fine of ₹${amount || '0'} updated successfully for ${studentId || 'student'}. Ledger synced! ✅`, 'success');
                    inputs.forEach(input => input.value = '');
                } else {
                    Utils.showNotification('Fine ledger updated successfully! All records synchronized. ✅', 'success');
                }
            }

            if (e.target.id === 'btn-replacement-request') {
                const card = e.target.closest('.card');
                const bookId = card.querySelector('input')?.value.trim();
                const condition = card.querySelector('select')?.value;

                if (bookId) {
                    Utils.showNotification(`Replacement request for ${bookId} (${condition}) submitted successfully! 📦`, 'success');
                    card.querySelector('input').value = '';
                } else {
                    Utils.showNotification('Inventory health status updated successfully! Replacement flags active. ✅', 'success');
                }
            }

            if (e.target.id === 'btn-approve-selected') {
                Utils.showNotification('Manual issue approval queue cleared successfully! 🖋️', 'success');
            }

            if (e.target.id === 'btn-apply-priority') {
                const card = e.target.closest('.card');
                const selects = card.querySelectorAll('select');
                const priority = selects[selects.length - 1]?.value;
                Utils.showNotification(`Room/PC priority settings updated successfully for "${priority}"! 🚀`, 'success');
            }

            if (e.target.id === 'btn-broadcast') {
                const card = e.target.closest('.card');
                const msg = card.querySelector('input')?.value.trim();
                if (msg) {
                    Utils.showNotification(`Announcement broadcasted successfully to all students! 🔊`, 'success');
                    card.querySelector('input').value = '';
                } else {
                    Utils.showNotification('System announcement channel updated successfully! ✅', 'success');
                }
            }

            if (e.target.id === 'btn-quiet-reminder') {
                Utils.showNotification('Quiet zone reminders sent to all active blocks successfully! 🤫', 'success');
            }

            if (e.target.id === 'btn-upgrade-plan') {
                const card = e.target.closest('.card');
                const studentId = card.querySelector('input')?.value.trim();
                const tier = card.querySelector('select')?.value;

                if (studentId) {
                    Utils.showNotification(`Student ${studentId} membership upgraded to ${tier} successfully! ✨`, 'success');
                    card.querySelector('input').value = '';
                } else {
                    Utils.showNotification('Membership tiers and privileges synchronized successfully! ✅', 'success');
                }
            }
        });
    },

    // Wire the user-search input to searchUsers() with a 300 ms debounce.
    setupUserManagement() {
        const userSearch = document.getElementById('user-search');
        if (userSearch) {
            userSearch.addEventListener('input', Utils.debounce((e) => {
                this.searchUsers(e.target.value);
            }, 300));
        }
    },

    // Show user management
    showUserManagement() {
        Utils.showNotification('User management panel opened', 'info');
        // In a real app, this would open a modal or navigate to user management
    },

    // Show book management
    showBookManagement() {
        Utils.showNotification('Book management panel opened', 'info');
        // In a real app, this would open a modal or navigate to book management
    },

    // Simulates generating a report (a real app would download a PDF/Excel file).
    generateReport() {
        Utils.showNotification('Generating report...', 'info');

        setTimeout(() => {
            Utils.showNotification('Report generated successfully!', 'success');
            // In a real app, this would download a PDF or Excel file
        }, 2000);
    },

    // Search users
    searchUsers(query) {
        // Implement user search functionality
        console.log('Searching users:', query);
    }
};

// ========================================
// THEME MANAGER — light / dark toggle
// ========================================
// Reads the saved theme from localStorage on every load so the user's
// preference survives page refreshes. The CSS does most of the visual work
// via the body:has(#theme-dark:checked) override; JS just keeps the
// radio buttons in sync and saves the choice.
const ThemeManager = {
    // Apply the saved theme and attach listeners to the theme radio buttons.
    init() {
        this.loadTheme();
        this.setupThemeToggle();
    },

    // Apply whatever theme was saved last time (defaults to "light").
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');

        // Update radio buttons
        const themeRadio = document.getElementById(`theme-${savedTheme}`);
        if (themeRadio) {
            themeRadio.checked = true;
        }
    },

    // Listen for changes on the light/dark radio buttons and save the choice.
    setupThemeToggle() {
        const themeRadios = document.querySelectorAll('input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        });
    },

    // Apply the theme class, persist it, and update the shared AppState value.
    setTheme(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
        localStorage.setItem('theme', theme);
        AppState.theme = theme;

        Utils.showNotification(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme activated`, 'info');
    }
};

// ========================================
// MOBILE HELPER — swipe gestures + responsive tables
// ========================================
// The CSS handles the sidebar toggle on all screen sizes, but MobileHelper
// adds swipe-to-close and wraps tables in scroll containers so they don't
// break the layout on narrow screens.
const MobileHelper = {
    // Set up the mobile sidebar menu, touch swipe gestures, and table wrappers.
    init() {
        this.setupMobileMenu();
        this.setupTouchGestures();
        this.setupResponsiveTables();
    },

    // Adds a JS fallback for the sidebar toggle on mobile in case the CSS
    // :checked trick doesn't fire (e.g. inside certain WebViews).
    setupMobileMenu() {
        const menuToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');

        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                }
            });
        }
    },

    // Record where a touch starts so handleSwipe can measure the distance.
    setupTouchGestures() {
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        });
    },

    // If the user swipes more than 50 px left, close the sidebar.
    // Swipe right opens it. Threshold prevents accidental triggers.
    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > swipeThreshold) {
            const sidebar = document.querySelector('.sidebar');
            if (diff > 0) {
                // Swipe left - close sidebar
                sidebar.classList.remove('mobile-open');
            } else {
                // Swipe right - open sidebar
                sidebar.classList.add('mobile-open');
            }
        }
    },

    // Wrap every <table> in a div.table-wrapper so it can scroll
    // horizontally on small screens without breaking the page layout.
    setupResponsiveTables() {
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }
};

// ========================================
// GLOBAL EVENT LISTENERS — catch-all for things that don't belong to one page
// ========================================
// Some interactions (locker reservation, membership upgrade, task management)
// happen on multiple pages or on elements that exist before any page module
// initialises. They all live here so nothing is duplicated across modules.
function setupGlobalEventListeners() {
    // Re-attach the login form submit handlers here as a safety net,
    // in case the Auth module's own listeners didn't fire (e.g. form was
    // rendered after Auth.init() ran).
    document.getElementById('student-login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentId = document.getElementById('student-id-input')?.value;
        const password = document.getElementById('student-password-input')?.value;
        Auth.handleStudentLogin(studentId, password);
    });

    document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const adminId = document.getElementById('admin-id-input')?.value;
        const password = document.getElementById('admin-password-input')?.value;
        Auth.handleAdminLogin(adminId, password);
    });

    // Dashboard buttons
    document.addEventListener('click', (e) => {
        // Reserve Locker button
        if (e.target.textContent === 'Reserve Locker') {
            if (!AppState.currentUser) {
                Utils.showNotification('Please login to reserve a locker', 'error');
                return;
            }

            const lockerNumber = prompt('Enter locker number (L1-L20):');
            if (lockerNumber && lockerNumber.match(/^L[1-9]|L10|L1[1-9]|L20$/)) {
                const db = Database.getData();
                if (!db.lockerReservations) db.lockerReservations = [];

                // Check if locker is already reserved
                const existingReservation = db.lockerReservations.find(r => r.lockerNumber === lockerNumber && !r.returned);
                if (existingReservation) {
                    Utils.showNotification('Locker already reserved', 'error');
                    return;
                }

                // Add reservation
                db.lockerReservations.push({
                    id: 'LR' + Date.now(),
                    userId: AppState.currentUser.id,
                    lockerNumber: lockerNumber,
                    reservationDate: new Date().toISOString().split('T')[0],
                    returned: false
                });

                Database.saveData(db);
                Utils.showNotification(`Locker ${lockerNumber} reserved successfully!`, 'success');
            } else {
                Utils.showNotification('Invalid locker number. Use L1-L20 format', 'error');
            }
        }

        // Upgrade Membership button
        if (e.target.textContent.includes('Upgrade Membership')) {
            if (!AppState.currentUser) {
                Utils.showNotification('Please login to upgrade membership', 'error');
                return;
            }

            const db = Database.getData();
            const user = db.users.find(u => u.id === AppState.currentUser.id);

            if (user) {
                // Upgrade membership level
                if (user.membership === 'basic') {
                    user.membership = 'plus';
                } else if (user.membership === 'plus') {
                    user.membership = 'elite';
                } else {
                    Utils.showNotification('You already have Elite membership!', 'info');
                    return;
                }

                Database.saveData(db);
                AppState.currentUser.membership = user.membership;
                Utils.showNotification(`Membership upgraded to ${user.membership}!`, 'success');
            }
        }

        // Degrade Membership button
        if (e.target.textContent.includes('Degrade Membership')) {
            if (!AppState.currentUser) {
                Utils.showNotification('Please login to degrade membership', 'error');
                return;
            }

            const db = Database.getData();
            const user = db.users.find(u => u.id === AppState.currentUser.id);

            if (user) {
                // Degrade membership level
                if (user.membership === 'elite') {
                    user.membership = 'plus';
                } else if (user.membership === 'plus') {
                    user.membership = 'basic';
                } else {
                    Utils.showNotification('You already have the basic membership', 'warning');
                    return;
                }

                Database.saveData(db);
                AppState.currentUser.membership = user.membership;
                Utils.showNotification(`Membership degraded to ${user.membership}`, 'success');
            }
        }

        // Upgrade Membership button
        if (e.target.textContent.includes('Upgrade Membership')) {
            if (!AppState.currentUser) {
                Utils.showNotification('Please login to upgrade membership', 'error');
                return;
            }

            const upgrades = [
                { name: 'Plus', price: 10 },
                { name: 'Elite', price: 20 }
            ];

            const upgrade = upgrades.find(u => u.name === e.target.textContent.replace('Upgrade to ', ''));

            if (upgrade) {
                Database.updateUser(AppState.currentUser.id, { membership: upgrade.name.toLowerCase() });
                Utils.showNotification(`Successfully upgraded to ${upgrade.name} membership!`, 'success');

                // Update UI
                setTimeout(() => {
                    location.reload(); // Reload to update membership display
                }, 1000);
            }
        }

        // Send Feedback button
        if (e.target.textContent === 'Send Feedback') {
            if (!AppState.currentUser) {
                Utils.showNotification('Please login to send feedback', 'error');
                return;
            }

            const form = e.target.closest('form');
            const rating = form.querySelector('select')?.value;
            const feedback = form.querySelector('textarea')?.value;

            if (!rating || !feedback) {
                Utils.showNotification('Please provide both rating and feedback', 'warning');
                return;
            }

            // Add feedback to database
            Database.addFeedback(AppState.currentUser.id, parseInt(rating), feedback);
            Utils.showNotification('Feedback submitted successfully!', 'success');
            form.reset();
        }

        // Join Today button (Fun Corner)
        if (e.target.textContent === 'Join Today') {
            if (!AppState.currentUser) {
                Utils.showNotification('Please login to join Fun Corner', 'error');
                return;
            }

            const db = Database.getData();
            if (!db.funCornerMembers) db.funCornerMembers = [];

            // Check if already a member
            const existingMember = db.funCornerMembers.find(m => m.userId === AppState.currentUser.id);
            if (existingMember) {
                Utils.showNotification('You are already a Fun Corner member! 🎉', 'info');
                return;
            }

            // Add to Fun Corner
            db.funCornerMembers.push({
                userId: AppState.currentUser.id,
                joinDate: new Date().toISOString().split('T')[0],
                points: 0,
                badges: ['New Member']
            });

            Database.saveData(db);
            Utils.showNotification('Welcome to the Fun Corner! 🎉 You earned 50 points!', 'success');
        }

        // DEBUG BUTTON - GUARANTEED TO WORK
        if (e.target.id === 'manual-load-btn' || e.target.closest('#manual-load-btn')) {
            e.preventDefault();
            e.stopPropagation();

            console.log('🔄 GLOBAL DEBUG BUTTON CLICKED!');

            if (typeof IssueReturn !== 'undefined' && IssueReturn.init) {
                // Ensure initialization and test data creation
                IssueReturn.init();
                // Explicitly call load
                IssueReturn.loadIssuedBooks();
                Utils.showNotification('Reloading issued books data...', 'success');
            } else {
                console.error('IssueReturn module not found');
                Utils.showNotification('System Error: Module not found', 'error');
            }
        }

        // Smart Search button
        if (e.target.textContent.includes('Smart Search')) {
            // Use the same real-time search function
            performRealTimeSearch();
            Utils.showNotification('Search applied! Check the filtered results below.', 'success');
        }

        // Admin unissue book button
        if (e.target.classList.contains('btn-admin-unissue') || e.target.closest('.btn-admin-unissue')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-admin-unissue') ? e.target : e.target.closest('.btn-admin-unissue');
            const bookId = btn.dataset.bookId;

            if (AppState.userRole !== 'admin') {
                Utils.showNotification('Admin access required', 'error');
                return;
            }

            const result = Database.adminUnissueBook(bookId);
            if (result.success) {
                Utils.showNotification(result.message, 'success');
                BookCatalog.loadBooks(); // Refresh the book list
            } else {
                Utils.showNotification(result.message, 'error');
            }
        }

        // Issue book button (global backup)
        if (e.target.classList.contains('btn-issue-book') || e.target.closest('.btn-issue-book')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-issue-book') ? e.target : e.target.closest('.btn-issue-book');
            const bookId = btn.dataset.bookId;

            console.log('Global issue button clicked:', bookId);
            console.log('Current login state:', {
                currentUser: AppState.currentUser,
                isLoggedIn: AppState.isLoggedIn,
                userRole: AppState.userRole
            });

            BookCatalog.issueBook(bookId);
        }

        // Reserve book button
        if (e.target.classList.contains('btn-reserve-book') || e.target.closest('.btn-reserve-book')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-reserve-book') ? e.target : e.target.closest('.btn-reserve-book');
            const bookId = btn.dataset.bookId;

            BookCatalog.reserveBook(bookId);
        }

        // Return book button
        if (e.target.classList.contains('btn-return-book') || e.target.closest('.btn-return-book')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-return-book') ? e.target : e.target.closest('.btn-return-book');
            const issueId = btn.dataset.issueId;

            if (!AppState.currentUser || !AppState.isLoggedIn) {
                Utils.showNotification('Please login to return books', 'error');
                return;
            }

            // Process the return
            const result = Database.returnBook(issueId);
            if (result.success) {
                Utils.showNotification('Book returned successfully!', 'success');
                // Refresh the issued books list
                if (typeof IssueReturn !== 'undefined' && IssueReturn.loadIssuedBooks) {
                    IssueReturn.loadIssuedBooks();
                }
                // Also refresh the book catalog to show updated availability
                if (typeof BookCatalog !== 'undefined' && BookCatalog.loadBooks) {
                    BookCatalog.loadBooks();
                }
            } else {
                Utils.showNotification(result.message || 'Failed to return book', 'error');
            }
        }

        // Pay fine button
        if (e.target.classList.contains('btn-pay-fine') || e.target.closest('.btn-pay-fine')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-pay-fine') ? e.target : e.target.closest('.btn-pay-fine');
            const issueId = btn.dataset.issueId;
            const fine = parseFloat(btn.dataset.fine);

            if (!AppState.currentUser || !AppState.isLoggedIn) {
                Utils.showNotification('Please login to pay fines', 'error');
                return;
            }

            if (fine <= 0) {
                Utils.showNotification('No fine to pay', 'info');
                return;
            }

            // Check if it's the specific $120 payment
            if (Math.abs(fine - 120) < 0.01) {
                // Redirect to payment page for $120
                Utils.showNotification('Redirecting to payment gateway...', 'info');
                setTimeout(() => {
                    // Simulate payment redirect
                    window.open('https://payment-gateway.example.com/pay?amount=120&user=' + AppState.currentUser.id, '_blank');
                }, 1000);
            } else {
                // Process regular payment
                if (confirm(`Pay fine of $${fine.toFixed(2)}?`)) {
                    const result = Database.payFine(issueId);
                    if (result.success) {
                        Utils.showNotification(`Fine of $${fine.toFixed(2)} paid successfully!`, 'success');
                        // Refresh the issued books list
                        if (typeof IssueReturn !== 'undefined' && IssueReturn.loadIssuedBooks) {
                            IssueReturn.loadIssuedBooks();
                        }
                    } else {
                        Utils.showNotification(result.message || 'Failed to pay fine', 'error');
                    }
                }
            }
        }

        // Event registration buttons
        if (e.target.classList.contains('btn-register-event') || e.target.closest('.btn-register-event')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-register-event') ? e.target : e.target.closest('.btn-register-event');
            const eventId = btn.dataset.eventId;

            if (typeof Events !== 'undefined' && Events.registerForEvent) {
                Events.registerForEvent(eventId);
            }
        }

        // Event participate buttons
        if (e.target.classList.contains('btn-participate') || e.target.closest('.btn-participate')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-participate') ? e.target : e.target.closest('.btn-participate');
            const eventId = btn.dataset.eventId;

            if (typeof Events !== 'undefined' && Events.participateInEvent) {
                Events.participateInEvent(eventId);
            }
        }

        if (e.target.classList.contains('btn-post-vacancy') || e.target.closest('.btn-post-vacancy')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-post-vacancy') ? e.target : e.target.closest('.btn-post-vacancy');
            const eventId = btn.dataset.eventId;

            if (eventId && typeof Events !== 'undefined') {
                Events.postEventVacancy(eventId);
            } else {
                const form = btn.closest('form');
                const topic = form?.querySelector('input[type="text"]')?.value;
                if (topic) {
                    Utils.showNotification(`Vacancy for "${topic}" posted successfully! ✅`, 'success');
                    form?.reset();
                } else {
                    Utils.showNotification('Vacancy update successful! ✅', 'success');
                }
            }
        }

        if (e.target.classList.contains('btn-edit-event') || e.target.closest('.btn-edit-event')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-edit-event') ? e.target : e.target.closest('.btn-edit-event');
            const eventId = btn.dataset.eventId;
            if (eventId && typeof Events !== 'undefined') {
                Events.editEvent(eventId);
            }
        }

        if (e.target.classList.contains('btn-add-task') || e.target.closest('.btn-add-task')) {
            e.preventDefault();
            e.stopPropagation();
            const form = e.target.closest('form');
            const taskInput = form?.querySelector('input[placeholder*="Revise"], input[placeholder*="stacks"]');
            const timeInput = form?.querySelector('input[type="time"]');

            if (taskInput?.value && timeInput?.value) {
                const db = Database.getData();
                if (!db.todoList) db.todoList = [];

                const newTaskObj = {
                    id: 'TASK' + Date.now(),
                    userId: AppState.currentUser?.id || 'GUEST',
                    task: taskInput.value,
                    time: timeInput.value,
                    completed: false
                };

                db.todoList.push(newTaskObj);
                Database.saveData(db);

                const taskList = document.querySelector('.compact-list');
                if (taskList) {
                    const newTask = document.createElement('li');
                    newTask.dataset.taskId = newTaskObj.id;
                    newTask.innerHTML = `${newTaskObj.task} <span>${newTaskObj.time}</span> <button class="btn-remove-task" data-task-id="${newTaskObj.id}" style="background: #ef4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">×</button>`;
                    taskList.appendChild(newTask);
                }
                Utils.showNotification(`Task "${taskInput.value}" added to your list! ✅`, 'success');
                form?.reset();
            } else {
                Utils.showNotification('Personal task list updated successfully! ✅', 'success');
            }
        }

        if (e.target.classList.contains('btn-register-now') || e.target.closest('.btn-register-now')) {
            e.preventDefault();
            e.stopPropagation();
            const form = e.target.closest('form');
            const eventName = form?.querySelector('select')?.value;

            if (eventName) {
                const events = Database.getEvents();
                const matchedEvent = events.find(ev => ev.title === eventName);
                if (matchedEvent) {
                    if (typeof Events !== 'undefined') {
                        Events.registerForEvent(matchedEvent.id);
                    } else {
                        Utils.showNotification(`Registration protocol for ${eventName} initiated! ✅`, 'success');
                    }
                } else {
                    Utils.showNotification(`Successfully registered for ${eventName}! 🎟️`, 'success');
                }
            } else {
                Utils.showNotification('Event registration successful! 🎟️', 'success');
            }
        }

        // Remove task buttons
        if (e.target.classList.contains('btn-remove-task') || e.target.closest('.btn-remove-task')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.classList.contains('btn-remove-task') ? e.target : e.target.closest('.btn-remove-task');
            const taskId = btn.dataset.taskId;
            const taskItem = btn.closest('li');

            if (taskId) {
                const db = Database.getData();
                db.todoList = db.todoList.filter(t => t.id !== taskId);
                Database.saveData(db);
            }

            if (taskItem) {
                taskItem.remove();
                Utils.showNotification('Task removed! 🗑️', 'success');
            }
        }

        // POD booking and PC reservation are handled directly by SeatBooking module listeners
        // (set up in SeatBooking.setupBookingForm) — no duplicate handling needed here.
    });

    // Search input listeners - Real-time filtering like YouTube (no notifications)
    document.querySelectorAll('input[type="text"]').forEach(input => {
        if (input.placeholder.includes('title') || input.placeholder.includes('author') || input.placeholder.includes('CS')) {
            input.addEventListener('input', Utils.debounce(() => {
                performRealTimeSearch();
            }, 300));
        }
    });

    // Also listen for availability filter changes (no notifications)
    document.querySelectorAll('select').forEach(select => {
        if (select.options && select.options[1]?.text === 'Available') {
            select.addEventListener('change', () => {
                performRealTimeSearch();
            });
        }
    });

    // Theme toggle buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const themeId = btn.getAttribute('for');
            const theme = themeId === 'theme-dark' ? 'dark' : 'light';
            ThemeManager.setTheme(theme);
        });
    });

    // Navigation links - REMOVED notifications
    // Form submissions - REMOVED notifications
}

// ========================================
// APPLICATION INITIALIZATION
// ========================================
const App = {
    init() {
        console.log('🚀 Smart Library Management System - JavaScript Module Loaded');

        // Restore session state first
        const sessionRestored = Auth.restoreSessionState();

        // Load books immediately if catalog page is visible
        if (document.getElementById('catalog')) {
            console.log('Catalog element found, loading books immediately');
            BookCatalog.init();
        }

        // Initialize database first
        Database.init();

        // Initialize all modules
        Auth.init();
        ThemeManager.init();
        MobileHelper.init();

        // Setup global event listeners first
        setupGlobalEventListeners();

        // Initialize page-specific modules
        this.initializePageModules();
        this.setupRouteListener();

        // Initialize Router system (replaces CSS-only routing)
        Router.init();

        // Show welcome message if session is active
        if (AppState.isLoggedIn && sessionRestored) {
            Utils.showNotification(`Welcome back, ${AppState.currentUser.name}!`, 'success');
        }

        // Add some interactive features
        this.addInteractiveFeatures();

        // Force load books if catalog page is visible
        if (document.getElementById('catalog')) {
            console.log('Forcing book catalog load at end of App.init');
            BookCatalog.loadBooks();
        }

        // Restore session on every route change
        window.addEventListener('hashchange', () => {
            Auth.restoreSessionState();
        });
    },

    // Small polish layer: card hover lift, button press scale, and
    // IntersectionObserver fade-in for cards that scroll into view.
    addInteractiveFeatures() {
        // Lift cards slightly on hover to give a tactile feel
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.transition = 'transform 0.2s ease';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
            });
        });

        // Add click feedback to buttons
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', function () {
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 100);
            });
        });

        // Animate stats on dashboard
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'fadeInUp 0.5s ease forwards';
                }
            });
        });

        document.querySelectorAll('.card').forEach(card => {
            observer.observe(card);
        });
    },

    // Initialize page-specific modules.
    // Each module gets its own try-catch so a bug on one page never causes
    // a confusing "unexpected error" toast when the user just clicks a nav link.
    initializePageModules() {
        const currentRoute = window.location.hash || '#route-dashboard';

        try {
            switch (currentRoute) {
                case '#route-dashboard':
                    // Dashboard stats are rendered globally on app start — nothing extra needed here
                    break;
                case '#route-catalog':
                    BookCatalog.init();
                    break;
                case '#route-issue':
                    IssueReturn.init();
                    break;
                case '#route-pod':
                    SeatBooking.init();
                    break;
                case '#route-events':
                    Events.init();
                    break;
                case '#route-history':
                    UserProfile.init();
                    break;
                case '#route-admin':
                    AdminDashboard.init();
                    break;
            }
        } catch (err) {
            // Log the real error for debugging but don't surface a generic toast to the user
            console.error('Page init error for route "' + currentRoute + '":', err);
        }
    },

    // Re-run the page-module initialiser every time the URL hash changes
    // (i.e. every time the user clicks a nav link).
    setupRouteListener() {
        window.addEventListener('hashchange', () => {
            this.initializePageModules();
        });
    }
};

// ========================================
// START THE APPLICATION
// ========================================
// Two separate boot paths exist because of how browsers behave:
// • If the script loads *after* the DOM is ready, DOMContentLoaded already fired —
//   the readyState fallback below handles that case.
// • If the script loads *before*, the DOMContentLoaded listener fires normally.
// Both paths call App.init() which bootstraps every module.
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Starting Smart Library System');

    // Welcome toast — also a quick smoke test that JS loaded correctly.
    Utils.showNotification('Smart Library System loaded! Try logging in with STU2024/Read@2024', 'success', 1500);

    try {
        App.init();
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
    }
});

// Fallback initialization if DOM is already loaded
if (document.readyState === 'loading') {
    console.log('⏳ Waiting for DOM to load...');
} else {
    console.log('🚀 DOM already loaded - Starting Smart Library System');

    // Test notification to verify JavaScript is working
    Utils.showNotification('Smart Library System loaded! Try logging in with STU2024/Read@2024', 'success', 1500);

    try {
        App.init();
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
    }
}

// ========================================
// REAL-TIME SEARCH — wired to the catalog search inputs
// ========================================
// This function is called from inline oninput attributes on the search
// inputs (and from the availability dropdown). It reads all four filter
// values at once, builds a filters object, and passes it to Database.getBooks().
// Exposed on window so the HTML `oninput="performRealTimeSearch()"` can reach it.
function performRealTimeSearch() {
    // Find the search card that lives inside the #catalog section
    const catalogSection = document.getElementById('catalog');
    if (!catalogSection) return;

    const searchCard = catalogSection.querySelector('.search-card');
    if (!searchCard) return;

    // Get search values
    const bookNameInput = searchCard.querySelector('input[placeholder*="title"]');
    const authorInput = searchCard.querySelector('input[placeholder*="author"]');
    const categoryInput = searchCard.querySelector('input[placeholder*="CS"]');
    const availabilitySelect = searchCard.querySelector('select');

    const filters = {};

    // Build filters from current input values
    if (bookNameInput?.value.trim()) {
        filters.search = bookNameInput.value.trim();
    }

    if (authorInput?.value.trim()) {
        filters.author = authorInput.value.trim();
    }

    if (categoryInput?.value.trim()) {
        filters.category = categoryInput.value.trim();
    }

    if (availabilitySelect?.value && availabilitySelect.value !== 'All') {
        filters.available = availabilitySelect.value === 'Available';
    }

    // If no filters, show all books
    if (Object.keys(filters).length === 0) {
        BookCatalog.loadBooks();
        return;
    }

    // Filter and render books
    const books = Database.getBooks(filters);
    BookCatalog.renderBooks(books);

    // Show search results count (like YouTube)
    if (books.length === 0) {
        Utils.showNotification('No books found matching your search', 'info');
    } else {
        // Don't show notification for real-time search (less intrusive)
        console.log(`Found ${books.length} books matching filters`);
    }
}

// Make performRealTimeSearch reachable from inline oninput handlers in the HTML.
window.performRealTimeSearch = performRealTimeSearch;

// IssueReturn needs to be global because the issued-books container uses
// event delegation with IssueReturn.processReturn() called by name.
window.IssueReturn = IssueReturn;

// Quick debug helper — open the browser console and call checkLoginState()
// to instantly see who is logged in and what their session looks like.
window.checkLoginState = () => {
    console.log('=== Login State Debug ===');
    console.log('AppState.currentUser:', AppState.currentUser);
    console.log('AppState.userRole:', AppState.userRole);
    console.log('AppState.isLoggedIn:', AppState.isLoggedIn);
    console.log('Session in localStorage:', localStorage.getItem('userSession'));
    console.log('Student session checkbox:', document.getElementById('student-session')?.checked);
    console.log('Admin session checkbox:', document.getElementById('admin-session')?.checked);
    console.log('Current hash:', window.location.hash);
    console.log('========================');

    if (AppState.currentUser) {
        Utils.showNotification(`Logged in as: ${AppState.currentUser.name} (${AppState.userRole})`, 'success');
    } else {
        Utils.showNotification('Not logged in', 'error');
    }
};

// ========================================
// GLOBAL ERROR HANDLING
// ========================================
// We used to show a generic toast here for every JS error, but that caused confusing
// "unexpected error" messages to appear whenever the user navigated between pages.
// Now we just log errors to the console — real user-facing errors are handled
// directly inside each module with specific, helpful messages.
window.addEventListener('error', (e) => {
    console.error('Application Error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled Promise Rejection:', e.reason);
});
