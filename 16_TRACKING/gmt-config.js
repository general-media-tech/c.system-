/* ══════════════════════════════════════════════════════════════════════
   gmt-config.js — مصدر الحقيقة الوحيد لمفاتيح قواعد البيانات
   أُنشئ 2026-07-12 · توصية المهندس المعتمدة من المالك.

   المشكلة التي يحلّه: رابط القاعدة والمفتاح كانا مكرَّرين يدوياً في 16 ملفاً
   عبر 4 قواعد مختلفة. أي تدوير مفتاح = 16 تعديل يدوي — وأول ملف تنساه يفشل
   بصمت (لا رسالة خطأ، فقط بيانات لا تُحمَّل).

   بعد اليوم: أي مفتاح جديد يُغيَّر هنا فقط، ويُنشر هذا الملف على المجلدات.
   ⚠️ الملفات القديمة ما زالت تحمل مفاتيحها المضمّنة (لم نلمسها كي لا تنكسر)؛
   الهجرة تدريجية: كل ملف يُعدَّل مستقبلاً يقرأ من هنا:
       const { url, key } = GMT_DB.MAIN;
   ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const GMT_DB = {
    /* القاعدة الرئيسية — نقاط البيع · الجرد · الأوردرات · المشتريات · العمولات */
    MAIN: {
      url: 'https://ysawzwtmodkqqbqoiojj.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzYXd6d3Rtb2RrcXFicW9pb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjI0OTUsImV4cCI6MjA5MjAzODQ5NX0.g-dBDpHzMsP_0IQAKFxzWkKzc_I13bGUMeYNgcUmrKQ',
    },

    /* قاعدة الكفالات — إنشاء الكفالة · إدارتها · البحث عنها */
    WARRANTY: {
      url: 'https://abppuwylukzpqckazegk.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFicHB1d3lsdWt6cHFja2F6ZWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTQ4NzYsImV4cCI6MjA5ODczMDg3Nn0.Dx6WCUfXD4T8D_tJclB9VuMUS3B0YSwejexrRrYhnqo',
    },

    /* قاعدة المتجر — المنتجات · الطلبات · العروض */
    STORE: {
      url: 'https://tupldwylzrkjzqtaiscv.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGxkd3lsenJranpxdGFpc2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTEzNTQsImV4cCI6MjA5MTA2NzM1NH0.RKsdAg4v7TcuMhBepztJtRdTtsR-f8cMcoDXKmnZXO0',
    },

    /* قاعدة الموقع الرئيسي — الأخبار · الوكلاء · بطاقات العروض */
    SITE: {
      url: 'https://znpakcaizvkwqzhosxvm.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucGFrY2FpenZrd3F6aG9zeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM0NTMsImV4cCI6MjA5NTkwOTQ1M30.YW3YuT-RRTpKw5WeFHkPeTUcXBBtaQFGCaCrBQWykks',
    },

  };

  /* رؤوس REST جاهزة لأي قاعدة: GMT_DB.headers(GMT_DB.MAIN) */
  GMT_DB.headers = (db, extra) => Object.assign({
    apikey         : db.key,
    Authorization  : 'Bearer ' + db.key,
    'Content-Type' : 'application/json',
  }, extra || {});

  /* عميل supabase-js جاهز (إن كانت المكتبة محمّلة) */
  GMT_DB.client = (db) => (global.supabase && global.supabase.createClient)
    ? global.supabase.createClient(db.url, db.key)
    : null;

  Object.freeze(GMT_DB);
  global.GMT_DB = GMT_DB;
})(window);
