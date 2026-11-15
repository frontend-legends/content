// Проверки к 19.10: компоненты из текста на настоящем React 19 в jsdom через Testing Library.
// Табы с клавиатурой по APG, аккордеон (исходный в режиме «одна секция» не закрывал открытую), модалка
// (Escape, оверлей, скролл, возврат фокуса), рейтинг с превью при наведении, секундомер (setTime(time + 1)
// застревает на 1), OTP (исходный не давал перезаписать цифру и не принимал вставку кода).
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

require('../../_lib/react.cjs');                                   // jsdom и React act — до Testing Library
const { render, screen, fireEvent, act, cleanup } = require('@testing-library/react') as typeof import('@testing-library/react');

// --- Tabs ---
function Tabs({ tabs }: { tabs: { label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  if (tabs.length === 0) return null;                              // краевой случай: нечего показывать
  const current = Math.min(active, tabs.length - 1);               // табы могли уменьшиться
  const focusTab = (i: number) => { setActive(i); refs.current[i]?.focus(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: current === last ? 0 : current + 1, ArrowLeft: current === 0 ? last : current - 1, Home: 0, End: last }[e.key];
    if (next !== undefined) { e.preventDefault(); focusTab(next); }
  };
  return (
    <div>
      <div role="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={current === i}
            aria-controls={`${id}-panel`}
            tabIndex={current === i ? 0 : -1}                       // в Tab-порядке только активный таб
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${current}`}>{tabs[current].content}</div>
    </div>
  );
}

// --- Accordion ---
type Item = { title: string; content: ReactNode };
function AccordionOriginal({ items, single = true }: { items: Item[]; single?: boolean }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOpen((prev) => {
    const next = single ? new Set<number>() : new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);                    // в single next пуст — открытую не закрыть
    return next;
  });
  return <div>{items.map((item, i) => (<div key={i}><button aria-expanded={open.has(i)} onClick={() => toggle(i)}>{item.title}</button>{open.has(i) && <div>{item.content}</div>}</div>))}</div>;
}
function Accordion({ items, single = true }: { items: Item[]; single?: boolean }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOpen((prev) => {
    const wasOpen = prev.has(i);                                    // решаем по прошлому состоянию
    const next = single ? new Set<number>() : new Set(prev);
    if (!wasOpen) next.add(i); else next.delete(i);
    return next;
  });
  return (
    <div>
      {items.map((item, i) => (
        <div key={item.title}>
          <button aria-expanded={open.has(i)} onClick={() => toggle(i)}>{item.title}</button>
          {open.has(i) && <div role="region">{item.content}</div>}
        </div>
      ))}
    </div>
  );
}

// --- Modal ---
function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;   // кто открыл — туда вернём фокус
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';                        // блокируем прокрутку фона
    dialogRef.current?.focus();                                     // фокус внутрь диалога
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;                  // восстанавливаем, а не затираем
      opener?.focus();                                              // возврат фокуса
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return createPortal(
    <div className="overlay" data-testid="overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Подтверждение" tabIndex={-1} ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// --- Star rating ---
function StarRating({ count = 5, value, onChange }: { count?: number; value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div role="group" aria-label="Оценка" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: count }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} из ${count}`}
          aria-pressed={star <= value}
          data-lit={star <= (hover || value)}                       // превью при наведении, иначе выбранное
          onMouseEnter={() => setHover(star)}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// --- Stopwatch ---
function StopwatchBuggy() {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTime(time + 1), 1000);         // замыкает time на момент запуска эффекта
    return () => clearInterval(id);
  }, [running]);                                                    // eslint react-hooks предупредил бы о time
  return <div><span data-testid="time">{time}</span><button onClick={() => setRunning((r) => !r)}>Старт</button></div>;
}
function Stopwatch() {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTime((t) => t + 1), 1000);     // функциональное обновление
    return () => clearInterval(id);                                 // обязательная очистка
  }, [running]);
  return (
    <div>
      <span data-testid="time">{time}</span>
      <button onClick={() => setRunning((r) => !r)}>{running ? 'Пауза' : 'Старт'}</button>
      <button onClick={() => { setRunning(false); setTime(0); }}>Сброс</button>
    </div>
  );
}

// --- OTP ---
function OTPInput({ length = 6, onComplete }: { length?: number; onComplete: (code: string) => void }) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const update = (next: string[], focusIndex: number) => {
    setValues(next);
    refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (next.every(Boolean)) onComplete(next.join(''));
  };
  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);                // последняя введённая цифра — можно перезаписать
    if (!digit) return;
    const next = [...values]; next[i] = digit;
    update(next, i + 1);                                            // автопереход
  };
  const handlePaste = (i: number, e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length - i).split('');
    if (!digits.length) return;
    e.preventDefault();
    const next = [...values];
    digits.forEach((d, k) => { next[i + k] = d; });                 // вставка кода целиком
    update(next, i + digits.length);
  };
  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key !== 'Backspace') return;
    e.preventDefault();
    const next = [...values];
    if (next[i]) { next[i] = ''; setValues(next); }                 // стираем текущую
    else if (i > 0) { next[i - 1] = ''; setValues(next); refs.current[i - 1]?.focus(); } // пустая — назад и стираем там
  };
  return (
    <div role="group" aria-label="Код из SMS">
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          aria-label={`Цифра ${i + 1}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={val}
          onChange={(e) => handleChange(i, e.target.value)}
          onPaste={(e) => handlePaste(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
}

async function main() {
  // --- табы: клик, стрелки по кругу, Home/End, роли и связи ---
  {
    render(<Tabs tabs={[{ label: 'Описание', content: 'текст' }, { label: 'Отзывы', content: 'отзывы' }, { label: 'Доставка', content: 'доставка' }]} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]);
    assert.equal(screen.getByRole('tabpanel').textContent, 'отзывы');
    assert.deepEqual(tabs.map((t) => t.getAttribute('aria-selected')), ['false', 'true', 'false']);
    assert.deepEqual(tabs.map((t) => t.tabIndex), [-1, 0, -1]);    // roving tabindex
    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' });              // с последнего — на первый
    assert.equal(document.activeElement, tabs[0]);
    fireEvent.keyDown(tabs[0], { key: 'End' });
    assert.equal(screen.getByRole('tabpanel').textContent, 'доставка');
    assert.equal(screen.getByRole('tabpanel').getAttribute('aria-labelledby'), tabs[2].id);
    assert.equal(tabs[0].getAttribute('aria-controls'), screen.getByRole('tabpanel').id);
    cleanup();
    const { container } = render(<Tabs tabs={[]} />);
    assert.equal(container.innerHTML, '');                          // пустой список — без падения
    cleanup();
  }

  // --- аккордеон: исходный в режиме single не закрывает открытую секцию ---
  {
    const items = [{ title: 'Доставка', content: 'курьером' }, { title: 'Оплата', content: 'картой' }];
    render(<AccordionOriginal items={items} />);
    fireEvent.click(screen.getByText('Доставка'));
    fireEvent.click(screen.getByText('Доставка'));                  // повторный клик — хотим закрыть
    assert.equal(screen.getByText('Доставка').getAttribute('aria-expanded'), 'true'); // а она открыта
    cleanup();
    render(<Accordion items={items} />);
    fireEvent.click(screen.getByText('Доставка'));
    fireEvent.click(screen.getByText('Оплата'));                     // single: открытие второй закрывает первую
    assert.deepEqual(screen.getAllByRole('button').map((b) => b.getAttribute('aria-expanded')), ['false', 'true']);
    fireEvent.click(screen.getByText('Оплата'));                     // повторный клик закрывает
    assert.equal(screen.queryByRole('region'), null);
    cleanup();
    render(<Accordion items={items} single={false} />);
    fireEvent.click(screen.getByText('Доставка')); fireEvent.click(screen.getByText('Оплата'));
    assert.equal(screen.getAllByRole('region').length, 2);         // multiple: открыты обе
    cleanup();
  }

  // --- модалка: Escape, оверлей, клик по содержимому, скролл и возврат фокуса ---
  {
    function App() {
      const [open, setOpen] = useState(false);
      return (<div><button onClick={() => setOpen(true)}>Удалить</button><Modal isOpen={open} onClose={() => setOpen(false)}><p>Точно удалить?</p><button>Да</button></Modal></div>);
    }
    render(<App />);
    const opener = screen.getByText('Удалить');
    opener.focus();
    fireEvent.click(opener);
    assert.equal(screen.getByRole('dialog').getAttribute('aria-modal'), 'true');
    assert.equal(document.activeElement, screen.getByRole('dialog')); // фокус внутри диалога
    assert.equal(document.body.style.overflow, 'hidden');
    fireEvent.click(screen.getByText('Точно удалить?'));            // клик по содержимому — не закрывает
    assert.ok(screen.queryByRole('dialog'));
    fireEvent.keyDown(document, { key: 'Escape' });
    assert.equal(screen.queryByRole('dialog'), null);
    assert.equal(document.body.style.overflow, '');                 // прокрутка вернулась
    assert.equal(document.activeElement, opener);                   // фокус вернулся к кнопке
    fireEvent.click(opener);
    fireEvent.click(screen.getByTestId('overlay'));                 // клик по фону — закрывает
    assert.equal(screen.queryByRole('dialog'), null);
    cleanup();
  }

  // --- рейтинг: превью при наведении поверх выбранного значения ---
  {
    function Rated() { const [v, setV] = useState(2); return <StarRating value={v} onChange={setV} />; }
    render(<Rated />);
    const stars = () => screen.getAllByRole('button').map((b) => b.dataset.lit);
    assert.deepEqual(stars(), ['true', 'true', 'false', 'false', 'false']);
    fireEvent.mouseEnter(screen.getByLabelText('4 из 5'));
    assert.deepEqual(stars(), ['true', 'true', 'true', 'true', 'false']); // превью 4
    fireEvent.mouseLeave(screen.getByRole('group'));
    assert.deepEqual(stars(), ['true', 'true', 'false', 'false', 'false']); // вернулось выбранное 2
    fireEvent.click(screen.getByLabelText('5 из 5'));
    assert.equal(screen.getByLabelText('5 из 5').getAttribute('aria-pressed'), 'true');
    cleanup();
  }

  // --- секундомер: setTime(time + 1) застревает, функциональное обновление — нет ---
  {
    mock.timers.enable({ apis: ['setInterval'] });
    const run = (Comp: () => ReactNode) => {
      render(<Comp />);
      fireEvent.click(screen.getByText('Старт'));
      for (let i = 0; i < 3; i++) act(() => { mock.timers.tick(1000); });
      const value = screen.getByTestId('time').textContent;
      cleanup();
      return value;
    };
    assert.equal(run(StopwatchBuggy), '1');                         // три секунды прошло, а на экране 1
    assert.equal(run(Stopwatch), '3');
    render(<Stopwatch />);
    fireEvent.click(screen.getByText('Старт'));
    act(() => { mock.timers.tick(2000); });
    fireEvent.click(screen.getByText('Пауза'));
    act(() => { mock.timers.tick(5000); });                         // на паузе время не идёт: интервал очищен
    assert.equal(screen.getByTestId('time').textContent, '2');
    cleanup();
    mock.timers.reset();
  }

  // --- OTP: ввод с автопереходом, перезапись, вставка, backspace ---
  {
    let completed = '';
    render(<OTPInput length={4} onComplete={(c) => { completed = c; }} />);
    const cells = () => screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(cells()[0], { target: { value: '1' } });
    assert.equal(document.activeElement, cells()[1]);               // автопереход
    fireEvent.change(cells()[0], { target: { value: '19' } });      // в заполненной ячейке набрали 9
    assert.equal(cells()[0].value, '9');                            // перезапись, а не отказ
    fireEvent.change(cells()[1], { target: { value: 'a' } });       // не цифра — игнор
    assert.equal(cells()[1].value, '');
    fireEvent.paste(cells()[1], { clipboardData: { getData: () => '72-58' } }); // вставка с мусором
    assert.deepEqual(cells().map((c) => c.value), ['9', '7', '2', '5']);
    assert.equal(completed, '9725');                                // код собран — колбэк вызван
    fireEvent.keyDown(cells()[3], { key: 'Backspace' });            // стирает текущую
    fireEvent.keyDown(cells()[3], { key: 'Backspace' });            // пустая — назад и стирает предыдущую
    assert.deepEqual(cells().map((c) => c.value), ['9', '7', '', '']);
    assert.equal(document.activeElement, cells()[2]);
    cleanup();
    // исходная проверка /^\d?$/ отвергала значение из двух символов — перезаписать цифру было нельзя
    assert.equal(/^\d?$/.test('19'), false);
  }

  console.log('components ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
