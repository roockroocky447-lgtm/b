import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SingleBook, SpreadBook } from "./book/Book";
import type { BookPage, PageType } from "./book/story";
import { DEFAULT_BOOK, arNum, maxTurn, uid } from "./book/story";

/* ==================================================================
   التخزين المحلي
   ================================================================== */

const KEY = "diwan.flipbook.v1";
const BREAKPOINT = "(max-width: 860px)";
const TYPES: PageType[] = ["cover", "title", "dedication", "story", "ornament"];

type Snapshot = { pages: BookPage[]; t: number; r: number };

const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** تُنظَّف البيانات القادمة من localStorage كي لا يتعطّل العرض */
function sanitize(input: unknown): BookPage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: BookPage[] = [];
  for (const raw of input) {
    const src = (raw ?? {}) as Record<string, unknown>;
    const type: PageType = TYPES.includes(src.type as PageType)
      ? (src.type as PageType)
      : "story";
    out.push({
      id: asStr(src.id) ?? uid(),
      type,
      title: asStr(src.title),
      subtitle: asStr(src.subtitle),
      author: asStr(src.author),
      body: asStr(src.body),
    });
  }
  return out;
}

function readSnap(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Snapshot>;
    const pages = sanitize(data?.pages);
    if (!pages) return null;
    return { pages, t: Number(data.t) || 0, r: Number(data.r) || 0 };
  } catch {
    return null;
  }
}

const boot: Snapshot | null = readSnap();
const bootPages: BookPage[] = boot?.pages ?? DEFAULT_BOOK;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/* ==================================================================
   أيقونات
   ================================================================== */

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
  </svg>
);
const IconPencil = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);
const IconSave = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);
const IconFolder = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);
const IconReset = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

/* ==================================================================
   التطبيق
   ================================================================== */

export default function App() {
  const [pages, setPages] = useState<BookPage[]>(bootPages);
  const [t, setT] = useState(() => clamp(boot?.t ?? 0, 0, maxTurn(bootPages.length)));
  const [r, setR] = useState(() => clamp(boot?.r ?? 0, 0, bootPages.length - 1));
  const [edit, setEdit] = useState(false);
  const [saved, setSaved] = useState<number | null>(boot ? Date.now() : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(BREAKPOINT).matches : false
  );

  const maxT = maxTurn(pages.length);
  const len = pages.length;
  const runningTitle = pages[0]?.title || DEFAULT_BOOK[0].title || "";
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setMsg(null), 2800);
  }, []);

  /* ---------- حفظ تلقائي ---------- */
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ pages, t, r }));
        setSaved(Date.now());
      } catch {
        setSaved(-1);
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [pages, t, r]);

  /* ---------- إبقاء الموضع ضمن الحدود ---------- */
  useEffect(() => {
    setT((x) => Math.min(x, maxT));
  }, [maxT]);
  useEffect(() => {
    setR((x) => Math.min(x, len - 1));
  }, [len]);

  /* ---------- التبديل بين العرض المزدوج والمفرد ---------- */
  useEffect(() => {
    const mq = window.matchMedia(BREAKPOINT);
    const onChange = () => {
      const n = mq.matches;
      if (n === narrow) return;
      if (n) setR(t === 0 ? 0 : 2 * t - 1);
      else setT(r === 0 ? 0 : Math.ceil(r / 2));
      setNarrow(n);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [narrow, t, r]);

  /* ---------- رسالة الافتتاح ---------- */
  useEffect(() => {
    if (boot) toast("تم فتح آخر نسخة محفوظة من هذا الجهاز");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- التنقل ---------- */
  const go = useCallback(
    (dir: 1 | -1) => {
      if (narrow) setR((x) => clamp(x + dir, 0, len - 1));
      else setT((x) => clamp(x + dir, 0, maxT));
    },
    [narrow, len, maxT]
  );

  /* ---------- لوحة المفاتيح ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft" || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowRight" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  /* ---------- تعديل / حذف / إضافة ---------- */
  const patchPage = useCallback((idx: number, patch: Partial<BookPage>) => {
    setPages((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }, []);

  const deletePage = useCallback(
    (idx: number) => {
      if (idx <= 0) {
        toast("لا يمكن حذف الغلاف");
        return;
      }
      if (len <= 4) {
        toast("يجب أن يبقى في الكتاب أربع صفحات على الأقل");
        return;
      }
      if (!window.confirm("هل تريد حذف هذه الصفحة نهائيًا؟")) return;
      setPages((p) => p.filter((_, i) => i !== idx));
      toast("حُذفت الصفحة");
    },
    [len, toast]
  );

  const deleteCurrent = useCallback(() => {
    if (narrow) {
      deletePage(r);
    } else {
      deletePage(t === 0 ? 0 : Math.min(t * 2, len - 1));
    }
  }, [narrow, r, t, len, deletePage]);

  const addPage = useCallback(() => {
    const at = narrow ? Math.min(r + 1, len) : t === 0 ? 2 : Math.min(2 * t + 1, len);
    const next = [...pages];
    next.splice(at, 0, { id: uid(), type: "story", body: "" });
    setPages(next);
    if (narrow) {
      setR(Math.min(at, next.length - 1));
    } else {
      const newMax = maxTurn(next.length);
      setT((x) => (x === 0 ? 1 : Math.min(x + 1, newMax)));
    }
    setEdit(true);
    toast("أُضيفت صفحة جديدة — اكتب فيها الآن");
  }, [pages, t, r, len, narrow, toast]);

  /* ---------- الحفظ والفتح والاستعادة ---------- */
  const saveNow = useCallback(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ pages, t, r }));
      setSaved(Date.now());
      toast("تم حفظ الكتاب بنجاح");
    } catch {
      toast("تعذَّر الحفظ في هذا المتصفح");
    }
  }, [pages, t, r, toast]);

  const loadNow = useCallback(() => {
    const s = readSnap();
    if (!s) {
      toast("لا توجد نسخة محفوظة بعد");
      return;
    }
    if (!window.confirm("سيتم استبدال الصفحات الحالية بالنسخة المحفوظة. هل تريد المتابعة؟")) return;
    setPages(s.pages);
    setT(clamp(s.t, 0, maxTurn(s.pages.length)));
    setR(clamp(s.r, 0, s.pages.length - 1));
    toast("تم فتح النسخة المحفوظة");
  }, [toast]);

  const resetBook = useCallback(() => {
    if (!window.confirm("سيُعاد الكتاب إلى قصّة «اعتراف لم أكتبه لأحد» الأصلية، وستفقد تعديلاتك. هل تريد المتابعة؟")) return;
    setPages(DEFAULT_BOOK);
    setT(0);
    setR(0);
    setEdit(false);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* تجاهل */
    }
    toast("تمت استعادة النسخة الأصلية");
  }, [toast]);

  /* ---------- مؤشر الموضع ---------- */
  const posLabel = useMemo(() => {
    const last = arNum(len - 1);
    if (narrow) return r === 0 ? "الغلاف" : `الورقة ${arNum(r)} من ${last}`;
    if (t === 0) return "الغلاف";
    return `الصفحتان ${arNum(2 * t - 1)}–${arNum(2 * t)} من ${last}`;
  }, [narrow, r, t, len]);

  const atEnd = narrow ? r >= len - 1 : t >= maxT;
  const atStart = narrow ? r <= 0 : t <= 0;
  const currentIdx = narrow ? r : t * 2;

  const bookProps = {
    runningTitle,
    edit,
    onPatch: patchPage,
    onDelete: deletePage,
  };

  /* ---------- سحب الورقة باللمس أو بالفأرة ---------- */
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (edit) return;
    const el = e.target as HTMLElement | null;
    if (el && typeof el.closest === "function" && el.closest(".zone")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = drag.current;
    drag.current = null;
    if (!s || edit) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    window.getSelection()?.removeAllRanges();
    go(dx > 0 ? 1 : -1);
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <>
      <div className="desk" aria-hidden="true" />

      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <b>الدفتر</b>
            <span>كتاب رقميّ تفاعليّ · قصّة «اعتراف لم أكتبه لأحد»</span>
          </div>
          <div className="status">
            <span className={`dot${edit ? " warn" : ""}`} />
            <span>
              {edit
                ? "وضع التحرير مُفعَّل — عدّل حقول الصفحة ثم اضغط حفظ"
                : saved === -1
                ? "تعذَّر الحفظ التلقائي"
                : saved
                ? "حُفِظت التعديلات تلقائيًا"
                : "جاهز"}
            </span>
            <span className="folio-indicator">{posLabel}</span>
          </div>
        </header>

        <main
          className="stage-wrap"
          style={{ touchAction: "pan-y" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={endDrag}
        >
          {narrow ? (
            <SingleBook {...bookProps} pages={pages} r={r} onGo={(n) => setR(clamp(n, 0, len - 1))} />
          ) : (
            <SpreadBook {...bookProps} pages={pages} t={t} onTurn={(n) => setT(clamp(n, 0, maxT))} />
          )}

          <p className="hint">
            {edit ? (
              <>
                عدّل الحقول الظاهرة في كل صفحة ثم اضغط <em>حفظ</em> — وزر <em>✕</em> أعلى الورقة يحذفها.
              </>
            ) : (
              <>
                اسحب الورقة، أو انقر حوافّها، أو استخدم <em>‹ ›</em> من لوحة المفاتيح، للتقليب.
              </>
            )}
          </p>
        </main>

        <footer className="tray">
          {/* التنقّل */}
          <button className="btn btn--nav" onClick={() => go(-1)} disabled={atStart}>
            <Chevron dir="right" />
            السابقة
          </button>
          <button className="btn btn--nav btn--gold" onClick={() => go(1)} disabled={atEnd}>
            التالية
            <Chevron dir="left" />
          </button>

          <span className="tray-sep" />

          {/* التحرير */}
          <button
            className={`btn${edit ? " is-on" : ""}`}
            onClick={() => {
              setEdit((v) => !v);
              toast(edit ? "انتهى وضع التحرير" : "وضع التحرير: انقر على أي نص لتعديله");
            }}
            aria-pressed={edit}
          >
            <IconPencil />
            {edit ? "إنهاء التحرير" : "وضع التحرير"}
          </button>
          <button className="btn" onClick={addPage}>
            <IconPlus />
            إضافة صفحة
          </button>
          <button
            className="btn btn--danger"
            onClick={deleteCurrent}
            disabled={currentIdx <= 0}
            title="حذف الصفحة الظاهرة"
          >
            <IconTrash />
            حذف الصفحة
          </button>

          <span className="tray-sep" />

          {/* الملف */}
          <button className="btn" onClick={saveNow}>
            <IconSave />
            حفظ
          </button>
          <button className="btn" onClick={loadNow}>
            <IconFolder />
            فتح
          </button>
          <button className="btn btn--ghost" onClick={resetBook}>
            <IconReset />
            استعادة الأصل
          </button>
        </footer>
      </div>

      {msg ? (
        <div className="toast" role="status">
          {msg}
        </div>
      ) : null}
    </>
  );
}
