const express = require('express');
const Database = require('better-sqlite3');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;
const ADMIN_PASSWORD = '1212';

// ============ اتصال به دیتابیس ============
const db = new Database('database.db');

// ساخت جداول
db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        option1 TEXT NOT NULL,
        option2 TEXT NOT NULL,
        option3 TEXT NOT NULL,
        option4 TEXT NOT NULL,
        correct INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_name TEXT NOT NULL,
        student_class TEXT NOT NULL,
        score REAL NOT NULL,
        correct_count INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        percentage REAL NOT NULL,
        answers TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// اگر دیتابیس خالی است، ۲۰ سوال پیش‌فرض اضافه کن
const countQ = db.prepare('SELECT COUNT(*) as c FROM questions').get();
if (countQ.c === 0) {
    const defaultQuestions = [
        ['معنی واژه «فراست» چیست؟', 'دانایی و هوشمندی', 'کوشش و تلاش', 'بزرگواری', 'سخاوت', 0],
        ['در جمله «او را به مهمانی دعوت کردند»، فعل چه نوع فعلی است؟', 'معلوم', 'مجهول', 'گذرا', 'ناگذر', 1],
        ['آرایه ادبی «تشخیص» در کدام گزینه دیده می‌شود؟', 'ابر و باد و مه و خورشید و فلک در کارند', 'دست در حلقه آن زلف دو تا نتوان کرد', 'به نام خداوند جان و خرد', 'سرو چمان من چرا میل چمن نمی‌کند', 0],
        ['معنی «سرو چمان» چیست؟', 'سرو خرامان', 'سرو بلند', 'سرو کوتاه', 'سرو خشک', 0],
        ['کدام گزینه از آثار سعدی است؟', 'گلستان', 'مثنوی', 'دیوان حافظ', 'خمسه', 0],
        ['در عبارت «کتاب را بخوان»، «را» چه نقشی دارد؟', 'نشانه مفعول', 'حرف اضافه', 'نشانه فاعل', 'حرف ربط', 0],
        ['مترادف واژه «شجاع» کدام است؟', 'دلیر', 'ترسو', 'باهوش', 'بخیل', 0],
        ['در «به نام خداوند جان و خرد»، «خرد» به چه معناست؟', 'عقل', 'جان', 'دل', 'علم', 0],
        ['کدام گزینه «صفت» است؟', 'زیبا', 'زیبایی', 'زیستن', 'زیست', 0],
        ['معنی «مستور» چیست؟', 'پوشیده', 'آشکار', 'بیدار', 'خواب', 0],
        ['کدام یک از عناصر داستان نیست؟', 'قافیه', 'شخصیت', 'زمان', 'مکان', 0],
        ['در «چشمه در دل کوه می‌جوشد»، کدام آرایه است؟', 'تشخیص', 'تشبیه', 'استعاره', 'کنایه', 0],
        ['مترادف «غمگین» کدام است؟', 'محزون', 'خوشحال', 'شادمان', 'مسرور', 0],
        ['کدام گزینه «فعل ماضی» است؟', 'رفتم', 'می‌روم', 'خواهم رفت', 'برو', 0],
        ['«دست و پا کردن» چه نوع کنایه‌ای است؟', 'تلاش کردن', 'راه رفتن', 'ورزش کردن', 'رقصیدن', 0],
        ['در «کتابِ من»، «ِ» چه نقشی دارد؟', 'کسره اضافه', 'حرف اضافه', 'نشانه مفعول', 'حرف ربط', 0],
        ['مخالف «آسان» کدام است؟', 'سخت', 'راحت', 'ساده', 'روان', 0],
        ['کدام گزینه «ضمیر» است؟', 'او', 'کتاب', 'خانه', 'درخت', 0],
        ['معنی «بی‌گمان» چیست؟', 'قطعاً', 'شاید', 'احتمالاً', 'شکاً', 0],
        ['کدام آرایه در «ماه چون نان است» وجود دارد؟', 'تشبیه', 'استعاره', 'کنایه', 'تشخیص', 0]
    ];
    const insert = db.prepare('INSERT INTO questions (text, option1, option2, option3, option4, correct) VALUES (?, ?, ?, ?, ?, ?)');
    const insertMany = db.transaction((qs) => { for (const q of qs) insert.run(...q); });
    insertMany(defaultQuestions);
    console.log('✅ ۲۰ سوال پیش‌فرض در دیتابیس ثبت شد');
}

// ============ Middleware ============
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============ API سوالات ============
// دریافت سوالات (بدون پاسخ صحیح برای دانش‌آموز)
app.get('/api/questions', (req, res) => {
    const rows = db.prepare('SELECT id, text, option1, option2, option3, option4 FROM questions ORDER BY id').all();
    const questions = rows.map(r => ({
        id: r.id,
        text: r.text,
        options: [r.option1, r.option2, r.option3, r.option4]
    }));
    res.json(questions);
});

// دریافت سوالات با پاسخ صحیح (برای ادمین)
app.get('/api/admin/questions', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM questions ORDER BY id').all();
    res.json(rows.map(r => ({
        id: r.id,
        text: r.text,
        options: [r.option1, r.option2, r.option3, r.option4],
        correct: r.correct
    })));
});

// افزودن سوال جدید
app.post('/api/admin/questions', requireAdmin, (req, res) => {
    const { text, options, correct } = req.body;
    if (!text || !Array.isArray(options) || options.length !== 4 || typeof correct !== 'number') {
        return res.status(400).json({ error: 'اطلاعات نامعتبر' });
    }
    const info = db.prepare(
        'INSERT INTO questions (text, option1, option2, option3, option4, correct) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(text, options[0], options[1], options[2], options[3], correct);
    res.json({ id: info.lastInsertRowid, success: true });
});

// حذف سوال
app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// بازگردانی پیش‌فرض (حذف همه و درج مجدد)
app.post('/api/admin/questions/reset', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM questions').run();
    // (اختیاری: می‌توانید سوالات پیش‌فرض را دوباره وارد کنید یا نیاز به ری‌استارت باشد)
    res.json({ success: true, message: 'سوالات پاک شدند. برای بازگردانی، سرور را ری‌استارت کنید.' });
});

// ============ API ثبت نمره (ارسال پاسخ‌ها) ============
app.post('/api/submit', (req, res) => {
    const { name, cls, answers } = req.body;
    // answers: [{ questionId, selected }, ...]

    if (!name || !cls || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'اطلاعات نامعتبر' });
    }

    // محاسبه نمره بر اساس دیتابیس
    const allQ = db.prepare('SELECT id, correct FROM questions').all();
    const correctMap = {};
    allQ.forEach(q => correctMap[q.id] = q.correct);

    let correctCount = 0;
    const detail = [];

    answers.forEach(a => {
        const correct = correctMap[a.questionId];
        const isCorrect = correct !== undefined && a.selected === correct;
        if (isCorrect) correctCount++;
        detail.push({ questionId: a.questionId, selected: a.selected, correct, isCorrect });
    });

    const total = allQ.length;
    const score20 = Math.round((correctCount / total) * 20 * 10) / 10;
    const percentage = Math.round((correctCount / total) * 100);

    const info = db.prepare(
        `INSERT INTO grades (student_name, student_class, score, correct_count, total_questions, percentage, answers)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(name, cls, score20, correctCount, total, percentage, JSON.stringify(detail));

    res.json({
        success: true,
        gradeId: info.lastInsertRowid,
        score: score20,
        correct: correctCount,
        total,
        percentage
    });
});

// ============ API کارنامه‌ها ============
// دریافت یک کارنامه با جزئیات
app.get('/api/grades/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM grades WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'کارنامه یافت نشد' });

    const answers = JSON.parse(row.answers);
    // پیوست اطلاعات سوال
    const enriched = answers.map(a => {
        const q = db.prepare('SELECT text, option1, option2, option3, option4 FROM questions WHERE id = ?').get(a.questionId);
        return {
            ...a,
            questionText: q ? q.text : 'حذف شده',
            options: q ? [q.option1, q.option2, q.option3, q.option4] : []
        };
    });

    res.json({
        id: row.id,
        name: row.student_name,
        cls: row.student_class,
        score: row.score,
        correct: row.correct_count,
        total: row.total_questions,
        percentage: row.percentage,
        date: row.created_at,
        answers: enriched
    });
});

// لیست همه کارنامه‌ها (ادمین)
app.get('/api/admin/grades', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT id, student_name, student_class, score, correct_count, total_questions, percentage, created_at FROM grades ORDER BY id DESC').all();
    res.json(rows.map(r => ({
        id: r.id,
        name: r.student_name,
        cls: r.student_class,
        score: r.score,
        correct: r.correct_count,
        total: r.total_questions,
        percentage: r.percentage,
        date: r.created_at
    })));
});

// پاک کردن همه کارنامه‌ها
app.delete('/api/admin/grades', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM grades').run();
    res.json({ success: true });
});

// ============ Middleware ادمین ============
function requireAdmin(req, res, next) {
    const pass = req.headers['x-admin-password'] || req.query.password;
    if (pass !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'دسترسی غیرمجاز' });
    }
    next();
}

// بررسی رمز ادمین
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'رمز اشتباه است' });
    }
});

// ============ راه‌اندازی ============
app.listen(PORT, () => {
    console.log(`\n🚀 سرور روی http://localhost:${PORT} اجرا شد`);
    console.log(`🔐 رمز ادمین: ${ADMIN_PASSWORD}\n`);
});
