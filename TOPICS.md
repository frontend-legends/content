# Карта тем

Что уже разобрано и где: заголовки `##` и `###` всех глав. Файл собирается командой `node tools/topics.mjs` — руками не правится.

Перед тем как писать про понятие, найди его здесь (и `grep -rli "<понятие>" --include="*.md" .`). Если у понятия уже есть свой раздел в другой теме — дай короткий контекст и ссылку, подробный разбор остаётся там.

## 1. Computer Science

- **1.01 Introduction** — `/content/computer-science/introduction`
  **Что такое Computer Science** · **Основные направления CS** · **Отличие Computer Science от Software Engineering** · **Почему это важно даже фронтенд-разработчику** · **Практическая ценность** · **Что будет дальше**
- **1.02 Data representation** — `/content/computer-science/data-representation`
  **Информация и биты** · Единицы измерения информации · **Системы счисления** · Основные системы · Переводы между системами · Где используется · **Представление информации** · Числа · Представление текста · **Представление мультимедиа** · Изображения · Звук · Видео
- **1.03 Computer architecture** — `/content/computer-science/computer-architecture`
  **Введение** · **Базовые компоненты** · **Модель фон Неймана и альтернативы** · **Инструкции и исполнение** · **Память и её иерархия** · **Оптимизация на уровне архитектуры** · **Современные тренды**
- **1.04 Languages and compilers** — `/content/computer-science/languages-and-compilers`
  **Введение** · Критерии, чтобы считаться языком программирования · Зачем нужны языки программирования · Низкоуровневые и высокоуровневые языки · Обзор языков программирования · **Классификация языков** · Машинный код и ассемблер · Высокоуровневые языки · Сценарные (interpreted) и компилируемые языки · Доменно-специфичные языки (DSL) · **Компиляторы и интерпретаторы** · **Виртуальные машины** · Зачем нужен байткод и виртуальная машина · **Языки программирования по направлениям** · Языки для мобильной разработки · Языки для backend-разработки · Языки для AI / ML / DS · Языки для Web3 и блокчейн-разработки · Frontend-разработка
- **1.05 Memory** — `/content/computer-science/memory`
  **Как языки программирования работают с памятью** · **Модели времени жизни объектов** · Этапы жизненного цикла объекта · Механики времени жизни по моделям · Достижимость (Reachability) и root-объекты · Дополнительные механизмы и оптимизации · **Управление памятью в популярных языках** · **C и C++** · **Java и C#** · **Python** · **Rust** · **Go** · **Swift и Objective-C** · **JavaScript** · Сравнение подходов · **Примеры проблем с памятью** · Memory leaks (утечки памяти) · Dangling references (аналог висячих указателей) · Buffer overflow (логические переполнения) · Fragmentation (фрагментация памяти) · **Как контролировать память** · **Полезные материалы**
- **1.06 Running the code** — `/content/computer-science/running-the-code`
  **Основной цикл выполнения** · **Как JS превращается в выполняемый код** · Лексический анализ и парсинг (Tokenizer / Parser) · Промежуточное представление (IR) и байткод (Ignition) · Интерпретация и сбор профиля исполнения · JIT-компиляция (Just-In-Time) - Turbofan · Оптимизация и генерация машинного кода · Деоптимизация (Deoptimization) · Итоговый поток исполнения · Пример: путь JS-кода в браузере · **Исполнение кода в других языках** · **Поток выполнения программы** · Что такое runtime · Компоненты выполнения в JavaScript · Асинхронность и события · Ошибки времени выполнения · Отладка и анализ потока выполнения · **Поток и порядок выполнения кода** · Последовательность · Ветвления · Циклы · Функции и вызовы · Исключения и отклонения потока · Асинхронность · Переходы и `goto` · **Работа комплиятора, общая схема** · 1. Лексический анализ (лексер, tokenizer) · Технические детали · Ошибки на этом этапе · **2) Синтаксический анализ (парсер)** · Цель · Что делает · Виды парсеров · Пример AST (псевдо-формат) · Обработка неоднозначностей · Ошибки на этапе парсинга · **3) Семантический анализ** · Цели · Основные операции · Примеры ошибок · Дополнительные шаги · **4) Промежуточное представление (IR) и трансформации** · Почему нужен IR · Виды IR · Пример трансляции выражения · **5) Оптимизации** · Локальные оптимизации · Глобальные оптимизации · SSA и анализ данных · Межпроцедурные оптимизации · Целевые оптимизации · **6) Построение графа потока управления (CFG) и SSA** · CFG · SSA · **7) Генерация кода / бекэнд** · Что происходит · Аллокация регистров · Calling conventions и ABI · Пример трёхадресного кода -> инструкции · **8) Сборка объектных файлов и линковка** · Объектные файлы · Линковка · Форматы · **Ошибки и сообщения компилятора**
- **1.07 Programming Paradigms** — `/content/computer-science/paradigms`
  **Исторический контекст** · **Базовые категории парадигм** · **Императивное программирование** · **Декларативное программирование** · **Процедурное программирование** · **Функциональное программирование (FP)** · **Объектно-ориентированное программирование (OOP)** · **Реактивное программирование** · **Смешанные подходы** · **Сравнение языков по парадигмам** · **Заключение** · **Полезные материалы**
- **1.08 Functional programming** — `/content/computer-science/fp`
  **Введение** · **Функции как объекты первого класса** · **Основные концепции FP** · Чистые функции (Pure Functions) · Функции высшего порядка · Композиция функций · Каррирование · Рекурсия вместо циклов · Частичное применение · Иммутабельность · Ленивые вычисления · Функторы и монады · Сопоставление с образом · **Функциональные типы данных (ADT)** · Product types (произведения) · Sum types (суммы) · Комбинирование · **Функциональные операции над коллекциями** · Основные операции · Ключевые идеи · Почему это важно · **Управление побочными эффектами** · Пример на JavaScript · Ключевые идеи · Пример из функциональных библиотек · **Point-free стиль и композиция** · Основная идея · Зачем использовать point-free стиль · Когда не стоит использовать point-free стиль
- **1.09 Object-oriented programming** — `/content/computer-science/oop`
  Определение · Основная цель · Дополнительные аспекты · **Из чего состоит ООП** · **Основные принципы** · Абстракция · Инкапсуляция · Наследование · Полиморфизм · **Принципы проектирования (SOLID)** · Single Responsibility Principle · Open/Closed Principle · Liskov Substitution Principle · Interface Segregation Principle · Dependency Inversion Principle · **Паттерны проектирования** · **Реализация в разных языках** · **Типичные проблемы и критика** · Почему фронтенд отходит от ООП · **Применение ООП в индустрии**
- **1.10 Reactive programming** — `/content/computer-science/reactive-programming`
  **Императивный подход vs реактивный** · **Ключевые концепции** · Push vs Pull · Observer Pattern (паттерн Наблюдатель) · Dependency Tracking (отслеживание зависимостей) · **Reactive Primitives (реактивные примитивы)** · Signal (сигнал) · Computed / Derived (вычисляемое значение) · Effect (эффект / побочное действие) · Реактивный граф · **Fine-Grained vs Coarse-Grained реактивность** · **Observables и RxJS** · Observable: базовая механика · Hot vs Cold Observable · Операторы: композиция потоков · switchMap vs mergeMap vs concatMap · **Backpressure** · **Реактивность во фреймворках** · Vue 3 · React · Solid.js · Angular (Signals + RxJS) · Сравнение реактивных моделей · **Распространённые паттерны**
- **1.11 Theory of computation** — `/content/computer-science/theory-of-computation`
  **Модели вычислений** · **Формальные грамматики и парсинг** · **Вычислимость и её пределы** · **Теория сложности (практический взгляд)** · **AI и ML: что нужно знать фронтенду** · **Что спрашивают на собеседованиях**
- **1.12 Math for CS** — `/content/computer-science/math-for-cs`
  **Логика и булева алгебра** · **Множества (Sets)** · **Комбинаторика и вероятности** · **Теория графов** · **Дискретная математика** · **Линейная алгебра (обзор)**
- **1.13 Threads** — `/content/computer-science/threads`
  **Процесс vs Поток** · **Concurrency vs Parallelism** · **Многозадачность** · **JavaScript: однопоточная модель** · Из чего состоит runtime · Порядок выполнения event loop · Блокировка main thread · **Web Workers: реальный параллелизм в браузере** · Типы Worker'ов · Dedicated Worker: пример · Transferable Objects · SharedArrayBuffer и Atomics · **Node.js: worker_threads** · **Проблемы многопоточности** · Race Condition (гонка данных) · Deadlock (взаимная блокировка) · Livelock · Starvation (голодание) · **Механизмы синхронизации** · Пример: простой mutex на Atomics · **Модели параллелизма** · Shared Memory (общая память) · Message Passing (передача сообщений) · CSP (Communicating Sequential Processes) · Actor Model (модель акторов) · **Практическое применение на фронтенде** · **Потоки в других языках: краткий обзор** · Go (goroutines) · Rust (std::thread + ownership) · Java (Thread + synchronized)
- **1.14 Encryption** — `/content/computer-science/encryption`
  **Encoding vs Hashing vs Encryption** · **Хэширование** · Свойства криптографической хэш-функции · Алгоритмы хэширования · Хэширование паролей · Применения хэширования · **Симметричное шифрование** · Алгоритмы · Режимы работы блочных шифров · Пример: AES-GCM в браузере (Web Crypto API) · **Асимметричное шифрование** · Алгоритмы · **Цифровая подпись** · **TLS/SSL и HTTPS** · TLS 1.3 Handshake · Сертификаты и цепочка доверия · **JWT (JSON Web Token)** · Структура · Алгоритмы подписи JWT · **Web Crypto API** · **Практические аспекты для фронтенда**
- **1.15 OS architecture** — `/content/computer-science/os-architecture`
  **Основные функции ОС** · **Пространство ядра и пространство пользователя** · Системные вызовы (Syscalls) · **Архитектурные модели ядра** · **Управление процессами** · Процесс · Жизненный цикл процесса · Планировщики (Schedulers) · Переключение контекста (Context Switch) · **Управление памятью** · Виртуальная память · Page Fault · Адресное пространство процесса · **Файловые системы** · Ключевые концепции · Сравнение файловых систем · **Ввод-вывод (I/O)** · Модели I/O · Node.js и libuv · **Безопасность и изоляция** · User Mode vs Kernel Mode · Права доступа (UNIX) · Sandboxing в браузере · **Виртуализация и контейнеры**
- **1.16 Intro to DB** — `/content/computer-science/intro-to-db`
  **Типы баз данных** · Реляционные (RDBMS) · NoSQL · NewSQL · **Обзор популярных баз данных** · PostgreSQL · MySQL · SQLite · MongoDB · Redis · Elasticsearch · Cassandra · Neo4j · ClickHouse · Что выбрать · **Реляционная модель** · Нормализация · **SQL - основные операции** · DDL, DML, DCL · JOIN'ы · **Транзакции и ACID** · Транзакция · ACID · Уровни изоляции · **Индексы** · Типы индексов · Важные концепции · EXPLAIN - план выполнения · Когда индексы вредят · **CAP-теорема** · **Масштабирование** · Репликация · Шардирование (Sharding) · **NoSQL: паттерны и примеры** · MongoDB (Document store) · Redis (Key-Value) · Neo4j (Graph) · **ORM и работа с БД из JavaScript/TypeScript** · Популярные инструменты · N+1 Problem · **Безопасность** · **Распределённые транзакции** · **БД на фронте** · Браузерные базы данных · **Частые вопросы на собесе**

## 2. Algorithms and Data structures

- **2.01 Data structures** — `/content/algorithms-data-structures/data-structures`
  **Интерфейс vs Реализация** · **Базовые структуры** · **Массивы** · Статический массив · Динамический массив · Многомерные массивы · **Связные списки** · Односвязный список (Singly Linked List) · Двусвязный список (Doubly Linked List) · Циклический список (Circular Linked List) · Skip List · **Стек и очереди** · Стек (Stack, LIFO) · Очередь (Queue, FIFO) · Дек (Deque, Double-Ended Queue) · Очередь с приоритетами (Priority Queue) · Кольцевая очередь (Circular Queue) · **Хеш-структуры** · Хеш-таблица (Hash Table, Hash Map) · Множество (Set) и Мультимножество (Multiset) · **Деревья (Trees)** · Binary Tree (Бинарное дерево) · Binary Search Tree (BST, Бинарное дерево поиска) · AVL Tree · Red-Black Tree · Splay Tree · Trie (Prefix Tree) · Fenwick Tree (Binary Indexed Tree) · Segment Tree (Дерево отрезков) · **Кучи (Heaps)** · Min-Heap (минимальная куча) · Max-Heap (максимальная куча) · Fibonacci Heap · **Графы (Graphs)** · Матрица смежности (Adjacency Matrix) · Список смежности (Adjacency List) · Directed Graph (Ориентированный граф) · Undirected Graph (Неориентированный граф) · Weighted Graph (Взвешенный граф) · Unweighted Graph (Невзвешенный граф) · DAG (Directed Acyclic Graph) · **Критерии выбора структуры данных**
- **2.02 Sorting algorithms** — `/content/algorithms-data-structures/sorting`
  **Bubble Sort** · **Insertion Sort** · **Selection Sort** · **Merge Sort** · **Quick Sort** · **Heap Sort** · **Counting Sort** · **Radix Sort** · **Bucket Sort** · **Shell Sort** · **TimSort**
- **2.03 Searching algorithms** — `/content/algorithms-data-structures/searching`
  **Линейный поиск (Linear Search)** · **Бинарный поиск (Binary Search)** · **Интерполяционный поиск (Interpolation Search)** · **Экспоненциальный поиск (Exponential Search)** · **Джамп-поиск (Jump Search)**
- **2.04 Strings and arrays** — `/content/algorithms-data-structures/strings-arrays`
  **Быстрый обзор** · Merge Sorted Arrays · Remove Element · Remove Duplicates from Sorted Array · Remove Duplicates from Sorted Array II · Majority Element · Rotate Array · Best Time to Buy and Sell Stock · Best Time to Buy and Sell Stock II · Jump Game · Jump Game II · H-Index · Insert Delete GetRandom O(1) · Product of Array Except Self · Gas Station · Candy · Trapping Rain Water · Roman to Integer · Integer to Roman · Length of Last Word · Longest Common Prefix · Reverse Words in a String · Zigzag Conversion · Find the Index of the First Occurrence in a String · Text Justification
- **2.05 Two pointers** — `/content/algorithms-data-structures/two-pointers`
  **Быстрый обзор** · Valid Palindrome · Is Subsequence · Two Sum II - Input Array Is Sorted · Container With Most Water · 3Sum
- **2.06 Sliding window** — `/content/algorithms-data-structures/sliding-window`
- **2.07 Matrix** — `/content/algorithms-data-structures/matrix`
- **2.08 Hashmap** — `/content/algorithms-data-structures/hashmap`
- **2.09 Intervals** — `/content/algorithms-data-structures/intervals`
- **2.10 Stack** — `/content/algorithms-data-structures/stack`
- **2.11 Linked list** — `/content/algorithms-data-structures/linked-list`
- **2.12 Binary tree general** — `/content/algorithms-data-structures/binary-tree-general`
- **2.13 Binary tree BFS** — `/content/algorithms-data-structures/binary-tree-bfs`
- **2.14 Binary search tree** — `/content/algorithms-data-structures/binary-search-tree`
- **2.15 Graph general** — `/content/algorithms-data-structures/graph-general`
- **2.16 Graph BFS** — `/content/algorithms-data-structures/graph-bfs`
- **2.17 Trie** — `/content/algorithms-data-structures/trie`
- **2.18 Backtracking** — `/content/algorithms-data-structures/backtracking`
- **2.19 Divide and Conquer** — `/content/algorithms-data-structures/divide-and-conquer`
- **2.20 Kadane's algorithm** — `/content/algorithms-data-structures/kadanes-algorithm`
- **2.21 Binary search** — `/content/algorithms-data-structures/binary-search`
- **2.22 Heap** — `/content/algorithms-data-structures/heap`
- **2.23 Bit manipulation** — `/content/algorithms-data-structures/bit-manipulation`
- **2.24 Math** — `/content/algorithms-data-structures/math`
- **2.25 1D DP** — `/content/algorithms-data-structures/1d-dp`
- **2.26 Multidimensional DP** — `/content/algorithms-data-structures/multidimensional-dp`
- **2.27 Other algorithms** — `/content/algorithms-data-structures/other`
  **Подходы к решению задач**

## 3. Web

- **3.01 What is web** — `/content/web/what-is-web`
  **Стандарты и организации** · **Путь от URL до пикселей** · **Архитектуры рендеринга** · **Веб как среда выполнения**
- **3.02 Browser engines** — `/content/web/browser-engines`
  **Многопроцессная архитектура** · **Компоненты рендерер-процесса** · **Движки браузеров** · **V8 в деталях** · Hidden Classes (Maps) и Inline Caching · Деоптимизация · **Garbage Collection в V8** · Что вызывает GC pressure · **Что спрашивают на интервью**
- **3.03 Rendering** — `/content/web/rendering`
  **Critical Rendering Path (CRP)** · **Парсинг HTML и построение DOM** · **Блокирующие ресурсы - стратегии загрузки скриптов** · **Resource Hints** · **Построение CSSOM** · **Render Tree** · **Layout (Reflow)** · **Paint** · **Compositing (Композитинг)** · **content-visibility: auto** · **requestAnimationFrame и requestIdleCallback** · **Виртуальный DOM и реальный рендеринг** · **DevTools: диагностика проблем рендеринга** · **Часто задаваемые вопросы на собеседовании** · **Оптимизация рендеринга - сводка**
- **3.04 DOM & Events** — `/content/web/dom-events`
  **DOM Tree** · **DOM Manipulation** · **Событийная модель** · **Event Delegation** · **Passive Listeners** · **AbortController** · **Custom Events** · **MutationObserver** · **Event Loop и рендеринг**
- **3.05 Browser APIs** — `/content/web/browser-apis`
  **IntersectionObserver** · Основные параметры · **ResizeObserver** · Доступные размеры · **Performance API** · User Timing · PerformanceObserver · Navigation Timing · **requestAnimationFrame** · **requestIdleCallback** · **AbortController** · **Page Visibility API** · **Broadcast Channel** · **Streams API** · **Сводная таблица** · **Типичные вопросы на собеседовании**
- **3.06 Core web vitals** — `/content/web/core-web-vitals`
  **Зачем нужны метрики производительности** · **LCP (Largest Contentful Paint) - глубокое погружение** · **INP (Interaction to Next Paint) - глубокое погружение** · **CLS (Cumulative Layout Shift) - глубокое погружение** · **Сводная таблица Core Web Vitals** · **Дополнительные метрики производительности** · **RUM vs Synthetic** · **Инструменты измерения** · **Оптимизация на практике - чек-лист** · **Типичные вопросы на собеседовании**
- **3.07 SEO** — `/content/web/seo`
  **Как работают поисковые системы** · **Рендеринг и индексация** · **Мета-теги** · Базовые мета-теги · Open Graph (социальные сети) · Twitter Cards · **Structured Data (JSON-LD)** · **Semantic HTML и SEO** · **URL, навигация и технические файлы** · **Интернационализация (i18n)** · **Производительность и ранжирование** · **Частые ошибки фронтендеров** · **Инструменты** · **SEO-чеклист для фронтенда**
- **3.08 DevTools** — `/content/web/devtools`
  **Обзор панелей** · **Performance Profiling** · **Memory Debugging** · **Network Analysis** · **Rendering Debugging** · **Console Power-User** · **Breakpoints** · **Source Maps** · **Практические сценарии для интервью**
- **3.09 PWA** — `/content/web/pwa`
  **Что такое PWA** · **Service Worker Lifecycle** · Этапы жизненного цикла · Регистрация Service Worker · install event - precaching · activate event - очистка старых кэшей · skipWaiting() и clients.claim() · Обновление Service Worker · **Стратегии кэширования** · Cache First · Network First · Stale-While-Revalidate · Cache Invalidation · **Offline** · **Web App Manifest** · **Push Notifications** · **Navigation Preload** · **Ограничения PWA** · **Когда PWA, а когда нет**
- **3.10 Future of web** — `/content/web/future-of-web`
  **WebAssembly (WASM)** · Реальные примеры использования · Загрузка и использование WASM из JS · WASI - WebAssembly System Interface · Component Model · **Web Components** · Custom Elements · Shadow DOM - инкапсуляция · Declarative Shadow DOM - совместимость с SSR · Когда Web Components vs фреймворк-компоненты · **Новые Web APIs** · View Transitions API · Popover API · Navigation API · Speculation Rules API · Scheduler API · **WebGPU** · **AI в браузере** · Текущие API и подходы · Практические сценарии · **Baseline & Interop** · **Что учить сейчас, а что наблюдать**

## 4. Network and API

- **4.01 Networking Fundamentals** — `/content/network-api/networking-fundamentals`
  **Клиент-серверная модель** · **IP-адреса и порты** · **TCP vs UDP** · **DNS: как домен превращается в IP** · **TLS/HTTPS: шифрование на транспортном уровне** · **CDN: ускорение доставки контента** · **Модель OSI и TCP/IP - кратко** · **Часто спрашивают на собеседовании**
- **4.02 HTTP** — `/content/network-api/http`
  **Структура HTTP-запроса и ответа** · **HTTP-методы** · **Статус-коды** · 1xx - Informational · 2xx - Success · 3xx - Redirection · 4xx - Client Error · 5xx - Server Error · **Ключевые заголовки** · Request headers · Response headers · Content Negotiation · **HTTP/1.1 vs HTTP/2 vs HTTP/3** · **HTTPS: что добавляет TLS** · **Сжатие** · **Часто спрашивают на собеседовании**
- **4.03 Request Lifecycle** — `/content/network-api/request-lifecycle`
  **Полная цепочка: от URL до пикселей** · **1. URL parsing и HSTS check** · **2. DNS Lookup** · **3. TCP Handshake** · **4. TLS Handshake** · **5. HTTP Request** · **6. Server Processing** · **7. HTTP Response (TTFB)** · **8. HTML Parsing и построение DOM** · **9. Загрузка субресурсов** · **10. Rendering Pipeline** · **Связь с Core Web Vitals** · **Повторная навигация и кэш** · **Ответ на собеседовании**
- **4.04 CORS** — `/content/network-api/cors`
  **Same-Origin Policy (SOP)** · Примеры сравнения origin · Что SOP блокирует и что нет · **CORS - Cross-Origin Resource Sharing** · **Simple Requests vs Preflight** · Как выглядит preflight · **Access-Control-\* заголовки** · Заголовки ответа (сервер устанавливает) · Заголовки запроса (браузер добавляет автоматически) · **Credentials и куки в cross-origin запросах** · **Типичные ошибки и как их решать** · Ошибка 1: «No 'Access-Control-Allow-Origin' header is present» · Ошибка 2: «The value of the 'Access-Control-Allow-Origin' header must not be the wildcard '\*'» · Ошибка 3: «Request header field authorization is not allowed» · Ошибка 4: Preflight на каждый запрос - тормоза · Обходное решение: прокси · **Частые вопросы на собесе**
- **4.05 REST API** — `/content/network-api/rest`
  **Constraints REST** · **Дизайн ресурсов** · URL Naming Conventions · Правила именования · **Методы и CRUD** · **Идемпотентность и безопасность** · **Статус-коды в контексте REST** · **Пагинация** · Offset-based · Cursor-based · Сравнение · **Формат ошибок** · **Best Practices для фронтендера** · **Частые вопросы на собесе**
- **4.06 GraphQL** — `/content/network-api/graphql`
  **Проблемы REST, которые решает GraphQL** · **Queries** · Вложенность - один запрос вместо трёх · Переменные и aliases · **Mutations** · **Subscriptions** · **Schema и Type System** · Ключевые концепции типов · **Fragments** · **Сравнение с REST** · **Клиентские библиотеки** · **Когда REST лучше, когда GraphQL** · Выбирай REST, когда: · Выбирай GraphQL, когда: · **Частые вопросы на собесе**
- **4.07 Data Fetching** — `/content/network-api/fetching`
  **fetch API** · Базовый синтаксис · Основные options · Полный пример: POST-запрос · Чтение ответа · **Обработка ошибок** · **AbortController: отмена запросов** · Очистка в React (useEffect cleanup) · **Race Conditions** · Решение: AbortController · **Таймауты** · Комбинация таймаута и ручной отмены · **Retry-стратегии** · **Паттерн SWR (Stale-While-Revalidate)** · **Обзор библиотек для запросов**
- **4.08 Caching** — `/content/network-api/caching`
  **Зачем кэшировать** · **HTTP-кэш: Cache-Control** · Основные директивы · Типичные комбинации · **Валидация кэша: ETag и Last-Modified** · ETag (Entity Tag) · Last-Modified · **Expires (legacy)** · **CDN-кэширование** · Стратегии CDN-кэширования · **Браузерный кэш** · **Application-level кэш** · **Cache Invalidation** · Стратегии инвалидации · **Полная картина: кэширование при деплое**
- **4.09 Authentication** — `/content/network-api/auth`
  **Аутентификация vs Авторизация** · **Cookies** · Атрибуты Cookie · SameSite подробнее · **Sessions (серверные сессии)** · **JWT (JSON Web Token)** · Структура JWT · Плюсы и минусы JWT · **OAuth 2.0** · Роли в OAuth · Authorization Code + PKCE (для SPA) · **Refresh Tokens** · Стратегии обновления · **Где хранить токены** · Рекомендации · **Что спрашивают на собеседованиях**
- **4.10 Browser Storage** — `/content/network-api/storage`
  **Cookies** · Ограничения · Атрибуты cookies · **localStorage** · **sessionStorage** · **IndexedDB** · **Cache API** · **Сравнительная таблица** · **Безопасность хранилищ** · **Типичные вопросы на собеседовании**
- **4.11 Realtime** — `/content/network-api/realtime`
  **Зачем нужен real-time** · **Short Polling** · **Long Polling** · **Server-Sent Events (SSE)** · Ключевые особенности · Формат данных · Клиентский API · **WebSocket** · Жизненный цикл · Клиентский API · Reconnect с exponential backoff · **Сравнительная таблица** · **Когда что использовать** · **Типичные вопросы на собеседовании**
- **4.12 API Patterns** — `/content/network-api/api-patterns`
  **Версионирование API** · **Пагинация** · Offset-based · Cursor-based · Keyset (seek-based) · Сравнение · **Rate Limiting на клиенте** · **Optimistic Updates** · **Error Handling** · Типы ошибок · Пример: централизованный error handler · **API-слой в приложении** · **OpenAPI / Swagger** · **Типичные вопросы на собеседовании**

## 5. HTML

- **5.01 HTML5 Fundamentals** — `/content/html/markup-language`
  **HTML5 Living Standard** · **Content Models (модели содержимого)** · Категории · Правила вложенности · Распространённые ошибки вложенности · **DOCTYPE и режимы парсинга** · Три режима · **Как браузер парсит HTML** · Этапы парсинга · Tokenizer (токенизатор) · Tree Construction (построение дерева) · Speculative Parsing (спекулятивный парсинг) · **HTML entities** · **Восстановление после ошибок парсинга** · **HTML vs XHTML** · **Частые вопросы на собесе**
- **5.02 Document Structure & Rendering** — `/content/html/structure`
  **Базовая структура документа** · **DOM-дерево** · Типы узлов · Пример DOM-дерева · **Critical Rendering Path (CRP)** · **Render-blocking ресурсы** · CSS блокирует рендеринг · JavaScript блокирует парсинг · Схема блокировки · **Reflow vs Repaint** · **Инкрементальный рендеринг** · **Частые вопросы на собесе**
- **5.03 Head content** — `/content/html/head-content`
  **Meta-теги** · Обязательные · SEO и описание · Open Graph и Twitter Cards · Другие полезные meta · **Link и ресурсные подсказки** · Базовое использование · Resource Hints · **Скрипты: async, defer, module** · Схема загрузки · Сравнение · **CSP через meta-тег** · **Style, base и noscript** · Style · Base · Noscript · **Частые вопросы на собесе**
- **5.04 Semantics & Tags** — `/content/html/tags`
  **Зачем нужна семантика** · **Семантические элементы HTML5** · Структурные (Sectioning) · Текстовые и контентные · **Section vs article vs div** · **Block vs Inline** · Дефолтное поведение · **Void elements (пустые элементы)** · **Document Outline (иерархия заголовков)** · Правила · **Устаревшие теги** · **Плохо / Хорошо: div soup vs семантика** · **Таблицы** · **Dialog** · **Details и summary** · **Списки: dl, dt, dd** · **Частые вопросы на собесе**
- **5.05 Attributes** — `/content/html/attributes`
  **Глобальные атрибуты** · **Data-атрибуты** · Доступ из JavaScript · Доступ из CSS · **Булевые атрибуты** · Основные булевые атрибуты · В JavaScript · **Attribute vs Property (DOM)** · Определения · Когда они расходятся · Таблица расхождений · Синхронизация · **Event-атрибуты** · **Атрибуты безопасности** · Rel noopener noreferrer · Sandbox (для iframe) · Crossorigin · Integrity (Subresource Integrity) · **Современные HTML-атрибуты** · **Частые вопросы на собесе**
- **5.06 Accessibility** — `/content/html/accessibility`
  **Зачем это нужно** · **WCAG 2.1** · Уровни соответствия · **Семантический HTML как основа** · **ARIA** · Первое правило ARIA · Roles (роли) · States & Properties (атрибуты) · `aria-label` vs `aria-labelledby` · **Навигация с клавиатуры** · `tabindex` · Focus trap (ловушка фокуса) · Skip link · **Скринридеры** · `aria-live` регионы · **Распространённые ошибки** · **a11y-чеклист для компонентов** · Модальное окно (Dialog) · Выпадающее меню (Dropdown) · Табы (Tabs) · Уведомления (Toast / Alert) · **Частые вопросы на собесе**
- **5.07 Forms** — `/content/html/forms`
  **Элемент form** · **Input types** · **Другие элементы форм** · Label · Textarea · Select, option и optgroup · Button · Fieldset и legend · Datalist · Output, progress и meter · **HTML5 Constraint Validation** · Атрибуты валидации · CSS-псевдоклассы · Constraint Validation API · **FormData API** · **События форм** · `submit` · `input` vs `change` · Другие события · **На фронте: controlled vs uncontrolled** · **Частые вопросы на собесе**
- **5.08 Media** — `/content/html/media`
  **Изображения (img)** · Ключевые атрибуты · **Responsive images** · 1. Resolution switching (srcset + sizes) · 2. Art direction (picture) · Когда что использовать · **Современные форматы изображений** · **Video и audio** · **SVG** · Способы вставки · Доступность SVG · **Canvas** · SVG vs Canvas · **Iframe** · Sandbox · Permissions Policy (allow) · Ленивая загрузка · Защита от clickjacking · PostMessage коммуникация · CSP и iframe · **Частые вопросы на собесе**
- **5.09 Web Components** — `/content/html/attributes`
  **Что такое Web Components** · **Custom Elements** · Создание · Lifecycle callbacks · Autonomous vs Customized Built-in · **Shadow DOM** · Создание · Open vs Closed · Light DOM vs Shadow DOM · **Template и slot** · Template · Slot · **CSS и Shadow DOM** · Инкапсуляция · Специальные селекторы · Part - стилизация извне · **Практический пример: Counter** · **На фронте: Web Components vs Framework Components** · Библиотеки поверх Web Components · **Частые вопросы на собесе**

## 6. CSS

- **6.01 Cascade & Styling** — `/content/css/styling`
  **Как CSS применяется к HTML** · **Каскад (Cascade)** · Порядок приоритета (от низшего к высшему) · Important · **Специфичность (Specificity)** · Примеры вычисления · Функциональные псевдоклассы и специфичность · **Наследование (Inheritance)** · Наследуемые (inherited) · Ненаследуемые (non-inherited) · Ключевые слова · **Box Model** · Box-sizing · Margin Collapse (схлопывание margins) · **Единицы измерения** · CSS-функции для значений · **Цвета** · **Частые вопросы на собесе**
- **6.02 Selectors & At-Rules** — `/content/css/css-rules`
  **Типы селекторов** · Базовые · Комбинаторы · Селекторы атрибутов · **Псевдоклассы** · Структурные · State (состояние) · Form (формы) · Функциональные · **Псевдоэлементы** · **At-rules** · Справочная таблица · Layer - управление каскадом · Property - типизированные custom properties · Supports - feature detection · Scope - scoped стили · **CSS-функции** · **Частые вопросы на собесе**
- **6.03 Layout & Flow** — `/content/css/flow`
  **Normal Flow** · **Display** · None vs visibility hidden vs opacity 0 · **Block Formatting Context (BFC)** · Что создаёт BFC · Зачем нужен BFC · **Позиционирование** · Position sticky - deep dive · Containing block · **Stacking Context** · Что создаёт stacking context · Пример: z-index не работает · Isolation isolate · **Flexbox** · Оси · Container properties · Item properties · Flex shorthand · **Grid** · Container properties · Ключевые функции · Auto-fill vs auto-fit · Named areas · Subgrid · **Flexbox vs Grid** · **Частые вопросы на собесе**
- **6.04 Responsive Web Design** — `/content/css/rwd`
  **Mobile-first vs Desktop-first** · **Media Queries** · Синтаксис · Полезные media features · **Container Queries** · Синтаксис · Container query units · Media queries vs Container queries · **Viewport Units** · Классические · Проблема 100vh на мобильных · Современные единицы · **Fluid Typography** · **Адаптивные паттерны** · Sidebar layout (Grid) · Card grid (auto-fit + minmax) · Stack-to-horizontal (Flexbox) · **Scroll Snap** · **Logical Properties** · **Частые вопросы на собесе**
- **6.05 Animations & Transitions** — `/content/css/animations`
  **Transitions** · Свойства · Что можно анимировать · **Keyframes и animation** · Свойства animation · Animation-fill-mode · **Timing Functions** · **Производительность анимаций** · Три уровня рендеринга · Какие свойства что вызывают · Will-change · **Prefers-reduced-motion** · **Scroll-driven Animations** · **View Transitions API** · **Частые вопросы на собесе**
- **6.06 Typography & Fonts** — `/content/css/typography`
  **Подключение шрифтов** · Font-face · Self-hosting vs CDN · **Font-display** · FOIT vs FOUT · **Variable Fonts** · Variation axes · **Текстовые свойства** · Line-height · White-space · Word-break vs overflow-wrap · Hyphens · **Текстовое переполнение** · Однострочное (ellipsis) · Многострочное (line-clamp) · **Text-wrap: balance / pretty** · Balance · Pretty · **Оптимизация загрузки шрифтов** · 1. Preload критичных шрифтов · 2. Subset через unicode-range · 3. Size-adjust для CLS prevention · **Частые вопросы на собесе**
- **6.07 Visual Effects** — `/content/css/visual-effects`
  **Backgrounds** · Множественные фоны · Background-size · Background-clip text · Background-attachment fixed · **Градиенты** · Linear-gradient() · Radial-gradient() · Conic-gradient() · Gradient borders · **Тени** · Box-shadow · Box-shadow vs drop-shadow filter · Text-shadow · **Filter и backdrop-filter** · Filter · Backdrop-filter · **Clip-path и mask** · Clip-path · Mask · **Mix-blend-mode и background-blend-mode** · Mix-blend-mode · Основные режимы · Background-blend-mode · **Border-radius и border-image** · Advanced border-radius · **Aspect-ratio** · **Частые вопросы на собесе**
- **6.08 Modern CSS** — `/content/css/modern-css`
  **CSS Custom Properties** · Scope и наследование · Dynamic: изменение через JS и CSS · Theming pattern · Custom Properties vs Preprocessor Variables · Property - типизированные custom properties · **CSS Nesting** · **:has() в действии** · Условная стилизация карточки · Глобальное состояние без JS · Quantity queries · **Новые цветовые пространства** · Почему oklch лучше HSL · Color-mix() и light-dark() · **CSS Performance** · Contain · Content-visibility auto · Селекторы и производительность · **Другие новинки** · Text-wrap: balance / pretty · Accent-color · Color-scheme · **Стилизация форм** · **Частые вопросы на собесе**
- **6.09 CSS Architecture** — `/content/css/architecture`
  **Проблема масштабирования CSS** · **Методологии именования** · BEM (Block Element Modifier) · Другие методологии · **CSS Modules** · Composes - композиция · **CSS-in-JS** · Runtime (styled-components, emotion) · Zero-runtime (vanilla-extract, Panda CSS) · Trade-offs · **Utility-first CSS** · Tailwind CSS / UnoCSS · Extraction через @apply (Tailwind) · Преимущества и недостатки · **Design Tokens** · **Сравнение подходов** · **Архитектурные паттерны** · Layer structure · Component-scoped · Token-driven · **На фронте: что выбрать** · **Частые вопросы на собесе**

## 7. JavaScript

- **7.01 Introduction** — `/content/javascript/introduction` · по стандарту
  **Что такое JavaScript** · **Язык и окружение** · **Где выполняется код** · **Модуль или скрипт: strict mode** · **Что движок делает с кодом** · Уровни компиляции V8 · Inline caches и деоптимизация · **Один поток** · Детали: агенты, общая память, пул libuv · Гонки без потоков · **Как язык меняется**
- **7.02 Types and Variables** — `/content/javascript/types-and-variables` · по стандарту
  **Какие бывают значения** · Восемь типов · Значение и ссылка · **Числа** · Один тип для всех чисел · Строки · **Приведение типов** · В число, строку и boolean · Объект в примитив · Оператор + · **Сравнение: ===, == и Object.is** · **Truthy, falsy и операторы по умолчанию** · Обёртки примитивов · **Переменные** · null и undefined
- **7.03 Objects and Arrays** — `/content/javascript/objects-and-arrays` · по стандарту
  **Объект — это словарь свойств** · Порядок ключей · `__proto__` — не обычный ключ · **Массив — объект с length** · Мутирующие и немутирующие методы · sort · Поиск и сравнение элементов · **Копирование** · Поверхностная копия · Глубокая копия · **Деструктуризация** · **Map и Set** · Map вместо объекта-словаря · Set · WeakMap и WeakSet
- **7.04 Functions** — `/content/javascript/functions` · по стандарту
  **Функция — это значение** · Функции высшего порядка · **Формы функций** · Специальные формы · **Параметры** · Значения по умолчанию · rest и arguments · Деструктуризация параметров · **Рекурсия** · Хвостовые вызовы не спасут · Чистые функции
- **7.05 Execution context** — `/content/javascript/execution-context` · по стандарту
  **Что такое контекст выполнения** · Лексическое окружение · **Hoisting и временная мёртвая зона** · Глобальная область · **Цепочка областей видимости — лексическая** · **this** · Четыре правила · Стрелки · Потеря контекста
- **7.06 Closures** — `/content/javascript/closures` · по стандарту
  **Функция помнит, где родилась** · **Ссылка на переменную, а не значение** · Каждый вызов — новое окружение · **Ловушка с var в цикле** · **Зачем замыкания на практике** · Приватное состояние · Функции с настройками · Обработчики событий · **Замыкания и память** · Типичные утечки · Общий контекст в V8 · Как увидеть замыкание
- **7.07 Prototypes and classes** — `/content/javascript/prototypes-and-classes` · по стандарту
  **Цепочка прототипов** · Запись не идёт по цепочке · **Конструкторы и new** · prototype и [[Prototype]] · Что делает new · **Классы** · Наследование · Порядок инициализации · Поля определяются, а не присваиваются · **Приватные поля** · **instanceof и проверка типов** · Наследование или композиция
- **7.08 Event Loop** — `/content/javascript/event-loop` · по стандарту
  **Один поток и стек вызовов** · **Задачи и микрозадачи** · await — это микрозадача · Порядок в обработчике клика · **Таймеры** · setInterval · **Отрисовка** · requestAnimationFrame · Микрозадачи и пользовательские события · Бесконечные микрозадачи · **Цикл Node.js** · process.nextTick
- **7.09 Async** — `/content/javascript/async` · по стандарту
  **Зачем асинхронность** · Колбэки · **Промисы** · Цепочки · **async и await** · return await · Последовательно или параллельно · forEach не ждёт · **Комбинаторы** · Ограничение параллельности · **Гонки и отмена** · Гонка ответов · AbortController
- **7.10 Error handling** — `/content/javascript/error-handling` · по стандарту
  **Как летит исключение** · try, catch, finally · **Объект Error** · Встроенные типы · Бросай только Error · **Свои классы ошибок** · Обёртка с причиной · **Ошибки в асинхронном коде** · fetch не отклоняется на 404 · Необработанные отклонения · **Стратегия** · Ожидаемые и неожиданные ошибки · Повторять только временное
- **7.11 Modules** — `/content/javascript/modules` · по стандарту
  **Зачем модули** · **ES-модули** · Статическая структура · Живые привязки · Модули в браузере · **CommonJS** · Взаимодействие форматов · **Циклические зависимости** · **Динамический импорт и top-level await** · import() · Top-level await · Атрибуты импорта · **Tree shaking**
- **7.12 Iterators and generators** — `/content/javascript/iterators-and-generators` · по стандарту
  **Протокол итерации** · Итератор одноразовый · for...of и for...in · Закрытие итератора · **Генераторы** · Ленивость · Двусторонний обмен · Очистка · Делегирование · **Асинхронные генераторы**
- **7.13 Metaprogramming** — `/content/javascript/metaprogramming` · по стандарту
  **Дескрипторы свойств** · defineProperty · Уровни защиты объекта · **Proxy** · Валидация · Инварианты · **Reflect и receiver** · Реактивность на Proxy · **Ограничения Proxy** · Прокси — другой объект · Внутренние слоты · Цена · Отзываемый прокси · **Символы** · Известные символы
- **7.14 Patterns** — `/content/javascript/patterns` · по стандарту
  **Debounce и throttle** · **Мемоизация** · Ключ кеша · Асинхронная мемоизация · **Каррирование и композиция** · Каррирование и частичное применение · compose и pipe · **События и подписки** · Observer и pub/sub · Middleware · **Объекты: фабрики, синглтон, стратегия** · Фабрика или класс · Синглтон · Стратегия
- **7.15 Memory and performance** — `/content/javascript/memory-and-performance` · по стандарту
  **Как живёт объект** · Достижимость · Mark-and-Sweep · Поколения в V8 · **Утечки памяти** · **Слабые ссылки** · **Как найти утечку** · **Измерение производительности** · Performance API · Долгие задачи · Что оптимизировать в самом JavaScript
- **7.16 Modern JS** — `/content/javascript/modern-js` · по стандарту
  **Как читать новинки языка** · **Что появилось в редакциях** · Логическое присваивание · **JSON** · Большие целые · **Intl: числа, даты и слова** · Числа и деньги · Даты и относительное время · Множественное число · Сортировка, графемы, списки · **Date и почему он плох** · **Temporal** · using

## 8. TypeScript

- **8.01 Introduction** — `/content/typescript/introduction` · по стандарту
  **Что такое TypeScript** · Типы стираются · **Структурная типизация** · Проверка лишних свойств · **Вывод и аннотации** · as — подсказка, а не преобразование · **Где TypeScript не защищает** · **Компилятор и инструменты** · **Как менялся TypeScript**
- **8.02 Basic types** — `/content/typescript/basic-types` · по стандарту
  **Примитивы и пустые значения** · **any, unknown, never, void** · any и unknown · never · void · {} и object · **Литеральные типы и расширение** · as const · **enum** · **Массивы, кортежи и объекты** · Массивы и кортежи · Объекты · **satisfies**
- **8.03 Functions and classes** — `/content/typescript/functions-and-classes` · по стандарту
  **Типы функций** · **Перегрузки** · **void и колбэки** · Бивариантность методов · Параметр this · **Классы** · private против # · Параметры-свойства · readonly, abstract, override · implements · **Декораторы**
- **8.04 Composing types** — `/content/typescript/composing-types` · по стандарту
  **Объединения и пересечения** · Объединение · Пересечение · **type и interface** · Слияние объявлений · extends против & · Неявная индексная сигнатура · Что выбрать · **Индексные сигнатуры** · **Типы из типов и значений** · **Расширение чужих типов**
- **8.05 Type Narrowing** — `/content/typescript/type-narrowing` · по стандарту
  **Как работает сужение** · **Встроенные защитники** · typeof · Истинность · Равенство · instanceof и Array.isArray · in · **Размеченные объединения** · Проверка полноты · **Предикаты и утверждения** · Предикат `x is T` · Выведенные предикаты · Утверждение `asserts x is T` · **Где сужение теряется и где устаревает** · Сохранённое условие · Замыкания · Свойства после вызова функции · catch
- **8.06 Generics** — `/content/typescript/generics` · по стандарту
  **Зачем нужны дженерики** · **Вывод параметров** · Частичного вывода нет · Значения по умолчанию · Запятая в .tsx · **Ограничения** · keyof в ограничении · T выбирает вызывающий · **Управление выводом** · const-параметры · NoInfer · **Вариантность**
- **8.07 Utility types** — `/content/typescript/utility-types` · по стандарту
  **Зачем утилиты** · **Модификаторы свойств** · Partial · Required · Readonly · **Выбор свойств** · Pick и Omit · Omit и объединения · Record · **Фильтрация объединений** · **Типы из функций и классов** · Перегрузки · Awaited · Классы · Строки и прочее
- **8.08 Advanced types** — `/content/typescript/advanced-types` · по стандарту
  **Зачем программировать на типах** · **Mapped-типы** · Модификаторы · Переименование и фильтрация ключей · **Условные типы и infer** · **Распределение по объединению** · Ловушки распределения · **Шаблонные литеральные типы** · **Рекурсивные типы** · Предел глубины · **Брендированные типы**
- **8.09 Project setup** — `/content/typescript/project-setup` · по стандарту
  **Что настраивает tsconfig** · **strict** · **Строже, чем strict** · noUncheckedIndexedAccess · exactOptionalPropertyTypes · Остальные · **target и lib** · types · **Модули** · Код собирает сборщик · Код запускает Node.js · paths · **Файлы объявлений** · declare module · skipLibCheck · **Эволюция**
- **8.10 Async and DOM** — `/content/typescript/async-and-dom` · по стандарту
  **Типы промисов** · new Promise · Комбинаторы · Ошибки · Забытый await · **Граница данных** · Ошибки как значения · Отмена · **DOM** · querySelector · События · Формы · Свои события
- **8.11 TypeScript + React** — `/content/typescript/ts-with-react` · по стандарту
  **Компоненты и пропсы** · FC или функция · children · Пропсы элементов и чужих компонентов · **Хуки** · useState · useRef · useReducer · Контекст без значения по умолчанию · **События** · currentTarget и target · **Переиспользуемые компоненты** · Дженерик-компоненты · Пропсы-объединения · Полиморфный as
- **8.12 TypeScript + Vue** — `/content/typescript/ts-with-vue` · по стандарту
  **script setup и проверка** · **Пропсы, события и v-model** · defineProps · defineEmits · defineModel · **ref, reactive и computed** · Развёртывание · **Ссылки на шаблон** · **provide и inject** · **Дженерик-компоненты и слоты** · **Сторы Pinia** · **Эволюция**

## 9. Reactjs

- **9.01 Introduction** — `/content/reactjs/introduction` · по стандарту
  **Что такое React** · **Декларативно, а не императивно** · **Что возвращает компонент** · **Рендер и commit** · Virtual DOM — это не про скорость · **Что запускает рендер** · **Однонаправленный поток данных** · **Что не входит в React** · **Как менялся React**
- **9.02 Components and JSX** — `/content/reactjs/components-and-jsx` · по стандарту
  **Компонент, элемент, экземпляр** · **Props — входные данные** · children — содержимое между тегами · **Композиция вместо наследования** · **JSX — это выражения** · Что рисуется из значений · Условия · **Списки и ключи** · Почему индекс в ключе — баг · key вне списков: сброс состояния · **Классовые компоненты** · Error boundary — то, что умеет только класс · **Рендер должен быть чистым**
- **9.03 State and Events** — `/content/reactjs/state-and-events` · по стандарту
  **Переменная или состояние** · **Состояние — это снимок** · Апдейтер: когда нужно предыдущее значение · Батчинг · **Состояние заменяют, а не мутируют** · Операции с массивами без мутации · Вложенные объекты · Мутация и memo · **События** · Делегирование: один слушатель на корень · Отличия от DOM · **Управляемые и неуправляемые поля** · Два частых бага
- **9.04 Hooks mechanics** — `/content/reactjs/hooks-mechanics` · по стандарту
  **Как useState помнит значение** · **Где лежит память: список ячеек на fiber** · Что лежит в ячейке у каждого хука · **Порядок вызовов вместо имён** · Модель в 50 строк · Что ты увидишь, если правило нарушено · Исключение: use · **Кто отвечает на вызов: диспетчер** · Две копии React · **Что делает setState** · Почему компонент иногда вызывается при том же значении · Начальное значение и функции в state · Приоритеты: очередь переигрывается · **Когда выполняются эффекты** · **Каждый рендер — снимок** · **Чистота: StrictMode и React Compiler** · **Как менялась механика**
- **9.05 Effects** — `/content/reactjs/effects-and-synchronization` · по стандарту
  **Что такое эффект и когда он нужен** · **Синхронизация, а не жизненный цикл** · Почему «`useEffect(fn, [])` — это `componentDidMount`» неточно · **Зависимости описывают, с чем синхронизируемся** · Что реактивно, а что нет · Зависимость убирают из кода, а не из массива · **Cleanup: что он обязан убрать** · Эффект не может быть async · Кто проверяет cleanup: StrictMode и Activity · **Гонки запросов** · Флаг ignore · AbortController · Почему данные лучше грузить не в голом эффекте · **Когда эффект не нужен** · Производные данные · Обработчики событий · Сброс состояния через key · **useLayoutEffect: измерить до отрисовки** · Порядок: от детей к родителю · Цена: кадр ждёт · На сервере эффектов нет · **useInsertionEffect: стили раньше всех** · **useEffectEvent: прочитать, но не реагировать** · Не способ заглушить линтер · Чем он лучше ref с последней функцией · **Как менялись эффекты**
- **9.06 Derived state** — `/content/reactjs/derived-state-and-data-flow` · по стандарту
  **Хранить или вычислять** · Идентификатор, а не копия · **Как устроить само состояние** · **Где живёт состояние** · Один владелец · Поднять состояние · Опустить состояние · **Состояние живёт в позиции** · Компонент внутри компонента · Сброс через key · **Состояние из props** · useState(prop) не следит за prop · Корректировка в рендере
- **9.07 Context API** — `/content/reactjs/context-api` · по стандарту
  **Зачем нужен контекст** · **Как работает контекст** · Кастомный хук с защитой · **Что происходит при смене значения** · **Ловушка: новый объект в value** · **Нет частичной подписки** · Разделить контексты · Селектор вручную · **Контекст — не стейт-менеджер**
- **9.08 Refs, Portals, a11y** — `/content/reactjs/refs-portals-a11y` · по стандарту
  **Задача: доступная модалка** · **Ref — ящик, который переживает рендеры** · Когда в ref появляется узел · Callback ref · **Ref на свой компонент** · ref как prop · useImperativeHandle: свой API вместо узла · **Порталы** · Нативный dialog · **Доступность** · Семантика вместо div с onClick · ARIA и подписи в JSX · Фокус в SPA
- **9.09 Hooks** — `/content/reactjs/advanced-hooks` · по стандарту
  **Какие хуки есть и какой брать под задачу** · **Карта встроенных хуков** · Состояние: что компонент помнит · Эффекты: с чем компонент синхронизируется · Ссылки и DOM: на что компонент ссылается · Производительность: что компонент не пересчитывает · Приоритеты: чему компонент уступает · Внешние сторы: что компонент читает снаружи · Идентификаторы · React 19: Actions и use · Отладка: как хук выглядит в DevTools · Как выбрать · **useState или useReducer** · Когда брать useReducer · Редьюсер вызывается в рендере · Начальное состояние и init · dispatch стабилен · Чего useReducer не умеет · **Кастомные хуки** · Правила и имя · Когда хук не нужен · Что возвращать · useDebouncedValue: эффект с cleanup · useMediaQuery: хук поверх внешнего источника · useLocalStorage: снимок должен быть стабильным · **useDebugValue: подпись для DevTools** · Почему форматирование отложено · Когда он нужен
- **9.10 Reconciliation and Fiber** — `/content/reactjs/reconciliation-and-fiber` · по стандарту
  **Задача: превратить дерево в изменения DOM** · **Эвристики сравнения** · **Как сравниваются списки** · Почему ключ решает всё · **Fiber: дерево как связный список** · Две версии дерева · Цикл работы · **Прерываемый рендер и lanes** · Кванты времени · Lanes · Suspense — тоже прерывание · **Commit и порядок эффектов**
- **9.11 Performance** — `/content/reactjs/performance` · по стандарту
  **Почему React-приложение тормозит** · **Рендер — не обновление DOM** · Откуда берутся рендеры · Когда React пропускает ребёнка · **Сначала измерь** · React DevTools · Profiler в коде · Performance panel и INP · А why-did-you-render? · **memo: пропустить рендер ребёнка** · Чего memo не делает · **useMemo и useCallback: когда они нужны** · Три случая, когда это окупается · Цена · **React Compiler** · На чём он держится · Чего компилятор не делает · Нужен ли ручной useMemo · **Структура вместо мемоизации** · Спустить state вниз · children как props · Разделить контекст · **Приоритеты: useTransition и useDeferredValue** · Что прерывается, а что нет · useTransition: обернуть свой апдейт · Transitions и Suspense · Чем это отличается от debounce · **Длинные списки: виртуализация и ключи** · Виртуализация · Ключи · **Как менялись инструменты**
- **9.12 State management** — `/content/reactjs/state-management` · по стандарту
  **Какое бывает состояние** · **Лестница решений** · **Стор вне React** · Tearing · **useSyncExternalStore** · Снимок должен быть стабильным · **Сторы на практике** · Redux Toolkit · Zustand · Jotai · Сравнение
- **9.13 Data fetching** — `/content/reactjs/data-fetching` · по стандарту
  **Почему серверные данные особенные** · **Загрузка в эффекте и что с ней не так** · **Библиотека запросов** · **Кеш: свежие и устаревшие данные** · **Мутации и инвалидация** · Оптимистичное обновление · **Suspense для данных** · **Водопады** · Как убирают водопады
- **9.14 Routing** — `/content/reactjs/routing` · по стандарту
  **Клиентский роутинг** · History API · Link вместо a · **Маршруты — это дерево** · **Данные на уровне маршрута** · Ленивые маршруты · **Защищённые маршруты** · **URL как состояние** · Фокус и прокрутка · **Какой роутер выбрать**
- **9.15 Patterns** — `/content/reactjs/patterns-and-component-design` · по стандарту
  **Задача: компонент вкладок** · **Композиция и слоты** · **Compound components** · Через cloneElement — хрупко · Через контекст — устойчиво · **Управляемый и неуправляемый режимы** · **Headless: логика без разметки** · Полиморфный компонент · **Переиспользование логики: от HOC к хукам** · HOC · Render props · Кастомные хуки · **Границы ошибок в дизайне приложения** · **Принципы API компонента**
- **9.16 Security** — `/content/reactjs/security` · по стандарту
  **Что React защищает сам** · **Ссылки** · **dangerouslySetInnerHTML** · **Spread пользовательских props** · **Серверный рендер** · Серверные функции — публичные эндпоинты · **Секреты и границы доверия**
- **9.17 Rendering and hydration** — `/content/reactjs/rendering-and-hydration` · по стандарту
  **Где создаётся HTML** · **Гидратация** · **Первый рендер должен совпасть** · Что React делает при расхождении · Откуда берутся расхождения · Как это лечат · useId · **Стриминг и выборочная гидратация** · Стриминг · Выборочная гидратация · Что дальше · **Как менялись SSR и гидратация**
- **9.18 RSC and React 19** — `/content/reactjs/rsc-and-react-19` · по стандарту
  **Проблема, которую решают Server Components** · **Что уходит в браузер** · RSC и SSR — не одно и то же · **Граница: 'use client'** · Что можно передать через границу · Как совмещать серверное и клиентское · **Серверные функции** · **Actions** · useActionState: результат и ожидание · useFormStatus: статус из глубины формы · useOptimistic: показать результат до ответа · **use** · **Остальное в React 19** · **Как менялся React 19**
- **9.19 Testing React** — `/content/reactjs/testing-react` · по стандарту
  **Что значит хороший тест** · **Как искать элементы** · get, query, find · **userEvent и fireEvent** · **Асинхронность и act** · act · waitFor и findBy · **Сеть: MSW вместо моков fetch** · **Провайдеры и тестовая обвязка** · Хуки · **Что React Testing Library не покрывает**

## 10. Vuejs

- **10.01 Introduction** — `/content/vuejs/introduction` · по стандарту
  **Что такое Vue** · **Как шаблон становится DOM** · Что компилятор знает о шаблоне · **Что запускает обновление** · **Однофайловые компоненты** · Как работает scoped · **Два API** · **Экосистема** · Vue, React и Angular · **Как менялся Vue**
- **10.02 Templates and directives** — `/content/vuejs/templates-and-directives` · по стандарту
  **Что такое шаблон** · Интерполяция · Выражения · Привязки атрибутов · **Условия: v-if и v-show** · **Списки: v-for и key** · Зачем key · v-if и v-for вместе · **Классы и стили** · **События и модификаторы** · **v-model** · Модификаторы · Ввод через IME · **Динамические компоненты и свои директивы** · `component :is` · Свои директивы · **Шаблоны или JSX**
- **10.03 Reactivity fundamentals** — `/content/vuejs/reactivity-fundamentals` · по стандарту
  **Что такое реактивность** · **Как это работает** · Следствия механизма · **ref и reactive** · Зачем .value · ref с объектом · reactive · Почему Proxy, а не геттеры · **Разворачивание ref** · **Где реактивность теряется** · Деструктуризация reactive · Передача значения в функцию · Замена reactive целиком · Деструктуризация в шаблоне и при возврате · **ref или reactive** · **Когда обновится DOM** · Живая ссылка и снимок
- **10.04 Composition API** — `/content/vuejs/composition-api` · по стандарту
  **Что такое Composition API** · **setup и script setup** · setup выполняется один раз · Что ещё делает script setup · **Жизненный цикл** · Порядок родителя и ребёнка · Хуки и await · Хуки или watch · **Макросы компилятора** · Закрытый компонент · **Options API** · Миксины · Сравнение
- **10.05 Computed and watchers** — `/content/vuejs/computed-and-watchers` · по стандарту
  **computed** · computed или метод · Стабильность значения · Правила · **watch** · Источники · Опции · Пачка изменений — один вызов · **watchEffect** · watch или watchEffect · **Когда вызывается колбэк** · **Очистка и гонки** · **Остановка** · **Что выбрать**
- **10.06 Components communication** — `/content/vuejs/components-communication` · по стандарту
  **Пропсы** · Проверки · Пропсы только для чтения · Свой экземпляр значения · **События** · События не всплывают · Зачем объявлять события · **v-model на компоненте** · defineModel · Несколько моделей и модификаторы · **Fallthrough-атрибуты** · Когда корень не тот · **Как выбрать способ связи**
- **10.07 Slots** — `/content/vuejs/slots` · по стандарту
  **Слот по умолчанию** · Область видимости · **Именованные слоты и запасное содержимое** · Проверка наличия слота · Динамические имена · **Scoped-слоты** · **Как работают слоты** · Невызванный слот ничего не создаёт · Зависимость слота принадлежит ребёнку · **Renderless-компоненты** · **Слоты и React**
- **10.08 Provide/inject** — `/content/vuejs/provide-inject` · по стандарту
  **Проблема** · **Как ищется значение** · Уровень приложения · **Реактивность** · Кто меняет данные · Точечные обновления · **Ключи и значения по умолчанию** · Значения по умолчанию · Ключи-символы · **Когда что использовать**
- **10.09 Composables** — `/content/vuejs/composables` · по стандарту
  **Что такое композабл** · Логика, а не состояние · **Аргументы** · **Что возвращать** · **Очистка** · onScopeDispose · **Общее состояние** · Опасность на сервере · **Композаблы, миксины и renderless-компоненты** · Чем композаблы отличаются от хуков React · **VueUse**
- **10.10 Reactivity advanced** — `/content/vuejs/reactivity-advanced` · по стандарту
  **Когда глубокая реактивность лишняя** · **shallowRef и shallowReactive** · **readonly** · **toRaw и markRaw** · Почему класс падает в reactive · **customRef** · **effectScope** · **Очередь обновлений и nextTick** · nextTick · Бесконечный цикл
- **10.11 Built-in components** — `/content/vuejs/built-in-components` · по стандарту
  **Teleport** · Куда всплывает клик · Цель и отключение · **Suspense** · **KeepAlive** · Что меняется · include, exclude и max · **Асинхронные компоненты** · **Transition и TransitionGroup**
- **10.12 State management** — `/content/vuejs/state-management` · по стандарту
  **Какое это состояние** · **Pinia** · Setup-стор · Options-стор · Возвращай всё состояние · **Использование** · Изменение состояния · $reset · Сторы, которые используют другие сторы · **Селекторы не нужны** · **Pinia и Vuex** · **SSR и плагины** · Стор на каждый запрос · Плагины
- **10.13 Data fetching** — `/content/vuejs/data-fetching` · по стандарту
  **Почему серверные данные особенные** · **Ручная загрузка** · **TanStack Query для Vue** · Ключ должен быть реактивным · Кеш и дедупликация · Мутации · Альтернативы · **Suspense и асинхронный setup** · Водопады · **Загрузка в Nuxt**
- **10.14 Routing** — `/content/vuejs/routing` · по стандарту
  **Как работает роутер** · Режимы истории · **Параметры и текущий маршрут** · Компонент переиспользуется · Вложенные маршруты · **Навигационные хуки** · Доступ к страницам · Уход со страницы · Результат перехода · **Ленивые маршруты** · **Адрес как состояние** · **Файловая маршрутизация и Nuxt**
- **10.15 Performance** — `/content/vuejs/performance` · по стандарту
  **Что Vue делает сам** · **Стабильность пропсов** · **v-once и v-memo** · v-once · v-memo · **Объём данных и DOM** · **Загрузка** · **Vapor mode** · **Профилирование**
- **10.16 Security** — `/content/vuejs/security` · по стандарту
  **Что Vue экранирует сам** · **v-html** · **Адреса в атрибутах** · **Атрибуты из чужого объекта** · **Пользовательский текст как шаблон** · CSP · **Секреты и клиентские проверки**
- **10.17 Rendering and Nuxt** — `/content/vuejs/rendering-and-nuxt` · по стандарту
  **Где создаётся HTML** · **SSR во Vue** · Стриминг · **Гидратация** · Расхождения · useId · Ленивая гидратация · **Nuxt** · Режимы рендеринга по маршрутам · Серверные компоненты · **Как выбрать**
- **10.18 Testing Vue** — `/content/vuejs/testing-vue` · по стандарту
  **Что проверять** · **Vue Test Utils** · Почему await · События · v-model · wrapper.vm · **Окружение компонента** · Плагины и провайдеры · Заглушки · Teleport · **Асинхронность и запросы** · **Testing Library для Vue** · **Композаблы** · **Что ещё**

## 11. Advanced Tooling

- **11.01 Introduction** — `/content/advanced-tooling/introduction` · по стандарту
  **Зачем нужен тулинг** · **Конвейер сборки** · **Разработка и продакшен** · Код для разработки · Хеши · **Из чего состоит тулчейн** · Ноль настроек — не ноль конвейера · **Куда движется тулинг** · **Как менялся тулинг**
- **11.02 Module systems** — `/content/advanced-tooling/module-systems` · по стандарту
  **Модули как язык и как инструменты** · **Как импорт находит пакет** · Поле exports · Формат файла · **Совместимость форматов** · ESM импортирует CommonJS · CommonJS загружает ESM · Флаг __esModule · **Двойной пакет** · **Модули в браузере**
- **11.03 Bundlers** — `/content/advanced-tooling/bundlers` · по стандарту
  **Зачем бандлить** · **Как работает бандлер** · Чанки · Scope hoisting · **Плагины** · Загрузчики и плагины в webpack · **Ландшафт** · **Приложение и библиотека**
- **11.04 Vite and dev servers** — `/content/advanced-tooling/vite-and-dev-servers` · по стандарту
  **Старая проблема** · **Разработка без сборки** · Пребандлинг зависимостей · **HMR** · **Окружение и ассеты** · Переменные окружения · Ассеты · Остальное · **Продакшен-сборка** · **Vite и webpack-dev-server** · **Как менялся Vite**
- **11.05 Transpilation** — `/content/advanced-tooling/transpilation` · по стандарту
  **Синтаксис и API** · Полифилы · **Цели и browserslist** · Значения по умолчанию · **Что понизить нельзя** · **Типы стираются без проверки** · **Инструменты** · **AST и кодмоды**
- **11.06 TypeScript tooling** — `/content/advanced-tooling/typescript-tooling` · по стандарту
  **Две роли tsc** · **Ограничения пофайловой трансформации** · isolatedModules · verbatimModuleSyntax · **Объявления типов** · **Скорость проверки** · Инкрементальность · Project references · TypeScript 7 · **Проверка в CI и в редакторе**
- **11.07 Optimization** — `/content/advanced-tooling/optimization` · по стандарту
  **Минификация** · **Tree shaking глазами бандлера** · Что ещё мешает · **Поле sideEffects** · Ловушка со стилями · **Разбиение на чанки** · **Сжатие** · **Анализ бандла**
- **11.08 Linting and formatting** — `/content/advanced-tooling/linting-and-formatting` · по стандарту
  **Линтер и форматтер** · **ESLint** · Как он находит ошибки · Flat config · Автоисправление · Своё правило · Правила с типами · **Форматтеры** · ESLint и Prettier вместе · **Нативные инструменты** · Stylelint · **Где запускать**
- **11.09 Git hooks and quality gates** — `/content/advanced-tooling/git-hooks-and-quality-gates` · по стандарту
  **Что такое git-хуки** · Почему хуки не доходят до коллег · **husky** · **lint-staged** · Частично подготовленные файлы · Что не класть в pre-commit · **Conventional Commits и commitlint** · **Оборона в глубину**
- **11.10 CI/CD** — `/content/advanced-tooling/ci-cd` · по стандарту
  **CI и CD** · **Пайплайн фронтенда** · GitHub Actions · **Воспроизводимая установка** · **Ускорение** · Кеш зависимостей · Не делать лишнего · **Гейты качества** · Бюджет размера · Защита веток · **Превью и выкладка**
- **11.11 Monorepo tooling** — `/content/advanced-tooling/monorepo-tooling` · по стандарту
  **Зачем монорепо** · **Workspaces** · Призрачные зависимости · **Оркестраторы задач** · Кеш задач · Только затронутое · Turborepo и Nx · **Внутренние пакеты** · **Когда монорепо**
- **11.12 DevTools and debugging** — `/content/advanced-tooling/devtools-and-debugging` · по стандарту
  **Зачем source maps** · **Что внутри карты** · Восстановление позиции · **Режимы карт и что выкладывать** · Публичная карта — это исходный код · **Ошибки из продакшена** · **Node.js** · Отладчик для Node.js · **Отладка сборки** · Инструменты фреймворков
- **11.13 Rust and the future** — `/content/advanced-tooling/rust-and-the-future` · по стандарту
  **Почему JavaScript-тулинг был медленным** · **Что это дало** · **Как к этому пришли** · **Консолидация** · **Цена** · Граница с JavaScript · Остальное · Как приходит бинарник · **Что это значит для разработчика**

## 12. Ecosystem libs

- **12.01 Introduction** — `/content/ecosystem-libs/introduction` · по стандарту
  **Писать самому или брать готовое** · **Сначала — платформа** · **Сколько стоит зависимость** · Размер в бандле · Транзитивные зависимости · **Критерии выбора** · Красные флаги · **Как жить с меняющейся экосистемой**
- **12.02 Package management** — `/content/ecosystem-libs/package-management` · по стандарту
  **Менеджеры пакетов** · **package.json и типы зависимостей** · Типы зависимостей · peerDependencies · **Semver** · **Lock-файл** · **Скрипты** · Скрипты при установке · Ещё о безопасности
- **12.03 UI component libraries** — `/content/ecosystem-libs/ui-component-libraries` · по стандарту
  **Что сложного в компоненте** · **Три подхода** · Библиотеки со стилями · Headless-библиотеки · Копирование кода · **Дизайн-система** · **Когда библиотека не нужна** · **Как выбрать**
- **12.04 Styling solutions** — `/content/ecosystem-libs/styling-solutions` · по стандарту
  **Варианты** · **Современный CSS как основа** · **CSS Modules** · **Tailwind** · Главная ловушка · Цена · **CSS-in-JS** · Во время выполнения · При сборке · **Серверные компоненты и SSR** · **Как выбрать**
- **12.05 Forms and validation** — `/content/ecosystem-libs/forms-and-validation` · по стандарту
  **Зачем библиотека** · **Контролируемая форма и её цена** · **Библиотеки форм** · react-hook-form · Другие · Actions в React 19 · **Схемы валидации** · Библиотеки · Standard Schema · **Клиент и сервер** · Нативная валидация · **Как выбрать**
- **12.06 State and data libraries** — `/content/ecosystem-libs/state-and-data-libraries` · по стандарту
  **Какое это состояние** · **Клиентское состояние** · Сторы с действиями · Атомы · Прокси · Сигналы · Автоматы состояний · **Серверное состояние** · **Нормализованный и документный кеш** · Нормализованный · Документный · **Как выбрать**
- **12.07 Meta-frameworks** — `/content/ecosystem-libs/meta-frameworks` · по стандарту
  **Что добавляет мета-фреймворк** · **Как фреймворк решает, как отдавать страницу** · Серверный код остаётся на сервере · **Острова: Astro** · **Ландшафт** · **Как выбрать**
- **12.08 Utility libraries** — `/content/ecosystem-libs/utility-libraries` · по стандарту
  **Сначала — язык** · **Глубокая копия** · **Неизменяемые обновления** · **Даты** · **HTTP-клиенты** · **Мелочи**
- **12.09 Animation** — `/content/ecosystem-libs/animation` · по стандарту
  **Сначала — CSS** · Что делает анимацию плавной · **Web Animations API** · **Библиотеки** · Motion · GSAP · Размер · Остальное · **View Transitions** · **Уважение к пользователю** · **Как выбрать**
- **12.10 Data visualization** — `/content/ecosystem-libs/data-visualization` · по стандарту
  **Уровни абстракции** · **D3 — это математика** · Размер · **SVG, Canvas и WebGL** · **Доступность графиков** · **Как выбрать**
- **12.11 Tables and grids** — `/content/ecosystem-libs/tables-and-grids` · по стандарту
  **Почему таблицы сложные** · **Headless и полный грид** · Headless: TanStack Table · Полные гриды · **Виртуализация** · Что ломает виртуализация · **На клиенте или на сервере** · **Как выбрать**
- **12.12 i18n** — `/content/ecosystem-libs/i18n` · по стандарту
  **Что входит в i18n** · **Intl и библиотеки** · **ICU MessageFormat** · Почему не склеивать фразы · **Библиотеки** · i18next · FormatJS и Lingui · vue-i18n · Размер · **Организация переводов** · Ключи и файлы · Ленивая загрузка · Выбор языка · **Серверный рендер** · **Справа налево** · **Как выбрать**
- **12.13 Realtime and API clients** — `/content/ecosystem-libs/realtime-and-api-clients` · по стандарту
  **Три стиля API** · **REST с типами: OpenAPI** · Генерация типов · Клиент по типам · **GraphQL-клиенты** · Ошибки приходят в теле · **tRPC** · **Реалтайм-библиотеки** · Socket.io · SSE и потоковые ответы · Готовые сервисы · **Как выбрать**
- **12.14 Rich content** — `/content/ecosystem-libs/rich-content-and-interactions` · по стандарту
  **Редакторы форматированного текста** · Почему не `contenteditable` · ProseMirror и TipTap · Другие редакторы · **Markdown** · Парсеры и XSS · MDX · **Подсветка кода** · **Перетаскивание** · Что не так с нативным API · dnd-kit и другие · **Загрузка файлов** · Что важно знать · **Как выбрать**
- **12.15 Auth libraries** — `/content/ecosystem-libs/auth-libraries` · по стандарту
  **Почему не писать самому** · **Библиотека или сервис** · **Библиотеки** · Better Auth · Auth.js · Passport и Lucia · **Сервисы** · **Что остаётся фронтенду** · Декодировать — не значит проверить · OAuth в SPA: PKCE · Обновление токена · Защита маршрутов · **Как выбрать**
- **12.16 Build and patch** — `/content/ecosystem-libs/building-and-patching` · по стандарту
  **Это всё JavaScript** · **Патч зависимости** · pnpm patch · patch-package · Патч — временная мера · Форк · **Своя библиотека** · package.json библиотеки · Сборка · Проверить пакет перед публикацией · Публикация · **Ядро и адаптеры**

## 13. Testing and Deploying

- **13.01 Introduction** — `/content/testing-deploying/introduction` · по стандарту
  **От коммита до продакшена** · **Что ловит каждый слой** · **Уверенность и цена** · Тест на найденный баг · **Сдвиг влево** · **Надёжная выкладка**
- **13.02 Testing strategy** — `/content/testing-deploying/testing-strategy-and-pyramid` · по стандарту
  **Виды тестов** · **Пирамида и трофей** · Пирамида · Трофей · **Что тестировать** · **Что не тестировать** · Почему тест на реализацию вреден · **Структура теста** · Smoke- и регрессионные тесты
- **13.03 Test runners** — `/content/testing-deploying/test-runners` · по стандарту
  **Что делает раннер** · Анатомия теста · **Vitest и Jest** · Другие раннеры · **Окружения DOM** · **Изоляция** · **Фильтры и наблюдение** · Забытый `.only`
- **13.04 Unit and integration** — `/content/testing-deploying/unit-and-integration-testing` · по стандарту
  **Модульный и интеграционный** · **Как пользователь** · **FIRST** · Независимость · **Асинхронность** · **Детерминированность** · Часовой пояс и локаль · Время, случайность и сеть
- **13.05 Mocking and test doubles** — `/content/testing-deploying/mocking-and-test-doubles` · по стандарту
  **Зачем подменять** · **Виды дублёров** · **Инструменты Vitest** · vi.fn · vi.spyOn · vi.mock и подъём · clear, reset, restore · **Фейковое время** · **Сеть: MSW** · **Не перемокать**
- **13.06 E2E testing** — `/content/testing-deploying/e2e-testing` · по стандарту
  **Что такое e2e** · **Playwright и Cypress** · **Локаторы** · **Ожидание** · Действия ждут сами · Проверки с повторами · **Нестабильные тесты** · Повтор — не лечение · **Изоляция и подготовка** · Свой контекст на каждый тест · Вход один раз · Подмена сети · Page Object · Скорость
- **13.07 Visual and component** — `/content/testing-deploying/visual-and-component-testing` · по стандарту
  **Чего не видят функциональные тесты** · **Визуальная регрессия** · Почему скриншоты шумят · Инструменты · **Компоненты в настоящем браузере** · **Storybook** · **Снапшоты** · **Доступность** · **Что когда**
- **13.08 Coverage and TDD** — `/content/testing-deploying/coverage-and-tdd` · по стандарту
  **Метрики покрытия** · **Пределы покрытия** · Порог в CI · **Мутационное тестирование** · **TDD** · **BDD** · **Сколько покрытия нужно**
- **13.09 Environments and config** — `/content/testing-deploying/environments-and-config` · по стандарту
  **Окружения** · **Переменные окружения** · **При сборке или при запуске** · Конфигурация при сборке · Конфигурация при запуске · Собрать один раз · **Секреты** · Где хранить · Если секрет попал в git
- **13.10 Hosting and platforms** — `/content/testing-deploying/hosting-and-platforms` · по стандарту
  **Статика или сервер** · **Статический хостинг** · Резервная отдача для SPA · Ловушка: HTML вместо скрипта · Подпапка и base · **Сервер** · Serverless · Edge · **Мета-фреймворки и платформы** · **Как выбрать**
- **13.11 Deployment strategies** — `/content/testing-deploying/deployment-strategies` · по стандарту
  **Почему выкладка рискованна** · **Стратегии** · Поочерёдная · Blue-green · Canary · **Флаги функций** · Выкладка и релиз · **Две версии одновременно** · Expand–contract · Старые вкладки · **Откат** · **Превью**
- **13.12 CDN and caching** — `/content/testing-deploying/cdn-and-caching` · по стандарту
  **CDN** · **Хешированные ассеты и свежий HTML** · Заголовки · **Ошибки с кешем** · Долгий кеш у index.html · Удалённые чанки · **Сброс кеша CDN** · **Кеш ответов на edge** · Изображения
- **13.13 Containers and Docker** — `/content/testing-deploying/containers-and-docker` · по стандарту
  **Что такое контейнер** · **Основы Docker** · **Многоэтапная сборка** · **Кеш слоёв и контекст** · Порядок шагов · .dockerignore · **nginx для SPA** · **Один образ — разные окружения** · **Когда контейнеры нужны**
- **13.14 Monitoring** — `/content/testing-deploying/monitoring-and-observability` · по стандарту
  **Зачем мониторинг** · **Трекинг ошибок** · Что перехватывается · Script error. · **Производительность в поле** · Не потерять событие · Что смотреть · **Логи, метрики, трейсы** · **Алерты и синтетика** · Алерты · Синтетические проверки · **Личные данные** · **Замыкая круг**

## 14. Additional Topics

- **14.01 Web Workers** — `/content/additional-topics/web-workers-and-concurrency` · по стандарту
  **Проблема главного потока** · **Web Worker** · Что есть в воркере · **Виды воркеров** · **Передача данных** · Копирование · Передача владения · **Общая память** · Нужна изоляция · Atomics · **OffscreenCanvas** · **Comlink** · **Когда нужен воркер** · React и параллельность
- **14.02 WebAssembly** — `/content/additional-topics/webassembly` · по стандарту
  **Что это** · **Не замена JavaScript** · **Числа на границе** · Ловушки · **Линейная память** · Строки и объекты · memory.grow · **Загрузка в браузере** · **Быстрее ли он** · **Где применяют** · **Инструменты** · **Вне браузера** · **Ограничения**
- **14.03 Graphics** — `/content/additional-topics/graphics-canvas-webgl` · по стандарту
  **Спектр** · SVG и Canvas · **Canvas 2D** · Немедленная отрисовка · Цикл кадров · **Чёткость и devicePixelRatio** · **Пиксели** · Испорченный canvas · **WebGL** · **WebGPU** · **Отрисовка в воркере** · **Доступность** · **Как выбрать**
- **14.04 Media and WebRTC** — `/content/additional-topics/media-and-webrtc` · по стандарту
  **Захват медиа** · Только безопасный контекст · Дорожки · Экран и запись · **Web Audio** · Жест пользователя · **WebRTC** · Без сервера — не совсем · SDP · STUN и TURN · Каналы данных · Много участников · **Потоковое видео** · **Сервисы**
- **14.05 Cross-platform** — `/content/additional-topics/cross-platform` · по стандарту
  **Спектр** · **React Native** · Рендерер · Что переносится и что нет · **Capacitor и Flutter** · **Десктоп** · Electron · Tauri · **PWA как приложение** · **Общий код** · Платформенные файлы · **Как выбрать**
- **14.06 AI in the frontend** — `/content/additional-topics/ai-in-the-frontend` · по стандарту
  **Что делает фронтенд** · **Ключ на сервере** · **Поток** · Чтение потока · Разорванные символы · Разорванные события · **Остановка генерации** · **Структурированный ответ** · **Вызов инструментов** · **Поиск по смыслу и RAG** · **AI SDK** · **Интерфейс и безопасность** · Состояния · Внедрение инструкций · Цена и задержка · **Модели в браузере**
- **14.07 Beyond frontend** — `/content/additional-topics/beyond-frontend` · по стандарту
  **Карта** · **Бэкенд** · Транзакции · N+1 запросов · Индексы · **Расширения браузера** · Изолированный мир · **Нативная мобильная разработка** · **Игры** · Фиксированный шаг · **Web3** · **Машинное обучение** · **DevOps и платформа** · **Системное и встраиваемое** · **Как переходить**

## 15. Modern Dev

- **15.01 AI-assisted development** — `/content/modern-dev/ai-assisted-development`
  **Категории инструментов** · **Как это работает** · **Prompt engineering для кода** · **В чём AI силён** · **В чём AI слаб и опасен** · **Как пользоваться осознанно** · **Сдвиг навыков** · **Влияние на собеседования** · **Вопросы на собеседовании**
- **15.02 AI agents and MCP** — `/content/modern-dev/ai-agents-and-mcp`
  **От ассистента к агенту** · **Цикл работы агента** · **MCP - Model Context Protocol** · **Context engineering** · **Что умеют агенты** · **Риски и границы** · **Траектория** · **Вопросы на собеседовании**
- **15.03 Developer experience** — `/content/modern-dev/developer-experience`
  **Что такое DX** · **Измерения DX** · **Цикл обратной связи** · **DX как конкурентное преимущество** · **DX внутри команды** · **DX библиотеки/API** · **Компромиссы** · **Измерение DX** · **Вопросы на собеседовании**
- **15.04 Signals and reactivity** — `/content/modern-dev/signals-and-reactivity`
  **Что такое сигнал** · **Fine-grained реактивность** · **Кто перешёл на сигналы** · **TC39 Signals proposal** · **Под капотом: ленивость и согласованность** · **Сигналы vs VDOM** · **Ментальная модель** · **Вопросы на собеседовании**
- **15.05 Edge computing** — `/content/modern-dev/edge-computing`
  **Зачем edge** · **Edge vs serverless** · **Ограничения edge-рантайма** · **Edge-рендеринг** · **Edge middleware** · **Проблема данных на edge** · **Когда использовать edge** · **Вопросы на собеседовании**
- **15.06 End-to-end type safety** — `/content/modern-dev/end-to-end-typesafety`
  **Проблема, которую решает** · **Слои типобезопасности** · БД → типы · Типизированный контракт API · Схема как источник истины · **Runtime vs compile-time** · **Движение «typesafe full-stack»** · **Выгоды** · **Границы подхода** · **Вопросы на собеседовании**
- **15.07 Local-first software** — `/content/modern-dev/local-first-software`
  **Проблема облачно-центричных приложений** · **Идея** · **CRDT - сердце подхода** · **Sync-движки** · **Выгоды** · **Сложности** · **Когда использовать** · **Вопросы на собеседовании**
- **15.08 Web platform evolution** — `/content/modern-dev/web-platform-evolution`
  **Платформа догоняет библиотеки** · **Знаковые новые API** · **Baseline** · **Interop** · **Почему это важно** · **Компромиссы** · **Вопросы на собеседовании**
- **15.09 The future of frontend** — `/content/modern-dev/the-future-of-frontend`
  **Куда движется фронтенд** · 1. AI-native разработка · 2. Ребаланс сервер ↔ клиент · 3. Resumability вместо гидратации · 4. Конвергенция на сигналах · 5. Платформа выигрывает · 6. Edge и распределённость · 7. Типобезопасность и local-first как дефолт · **Конвергенция фреймворков** · **Что НЕ изменится** · **Как оставаться актуальным** · **На что делать ставку** · **Вопросы на собеседовании**

## 16. Architecture

- **16.01 Architectural thinking** — `/content/architecture/architectural-thinking`
  **Разделение ответственности** · **Связанность и сцепление** · **Абстракция** · **SOLID для фронтенда** · **DRY, KISS, YAGNI** · **Границы** · **Композиция > наследование** · **Поддерживаемость > «умность»** · **Сложность: существенная и случайная** · **Когнитивная нагрузка** · **Проектирование под изменение** · **Вопросы на собеседовании**
- **16.02 Project structure** — `/content/architecture/project-structure`
  **Два подхода** · По типам (layer-based) · По фичам (feature-based) · **Колокация** · **Feature-Sliced Design** · **Границы модулей** · **Barrel-файлы** · **Направление зависимостей** · **Когда менять структуру** · **Принуждение границ инструментами** · **Вертикальные срезы** · **Вопросы на собеседовании**
- **16.03 Architectural patterns** — `/content/architecture/architectural-patterns`
  **MVC** · **MVP и MVVM** · **Flux и однонаправленный поток** · **Компонентная архитектура** · **Слоистая архитектура** · **Clean / Hexagonal архитектура** · **Современная реальность** · **Производные паттерны потока** · **Humble Object** · **Вопросы на собеседовании**
- **16.04 Component architecture** — `/content/architecture/component-architecture`
  **Иерархия компонентов** · **Atomic Design** · **Дизайн-системы** · **Контейнер и представление** · **Дизайн API компонента** · **Переиспользование vs специфичность** · **Границы компонента** · **Общая библиотека компонентов** · **Инверсия управления** · **Вопросы на собеседовании**
- **16.05 State and data** — `/content/architecture/state-and-data-architecture`
  **Таксономия состояния** · **Слой данных** · **Где живёт логика** · **Поток данных** · **Нормализация** · **Колокация vs глобальное** · **Сложные потоки - state machines** · **Кеширование как архитектура** · **Server-state изменил архитектуру данных** · **Команды, события и оптимистичность** · **Вопросы на собеседовании**
- **16.06 API and BFF** — `/content/architecture/api-and-bff`
  **Форма API влияет на фронтенд** · Over-fetching и under-fetching · **Проблема многих сервисов** · **BFF - Backend-for-Frontend** · BFF под каждый клиент · **BFF vs API Gateway** · **Edge как BFF** · **Контракты** · **Версионирование** · **Federation и server-driven UI** · **Контрактное тестирование** · **Вопросы на собеседовании**
- **16.07 Micro-frontends** — `/content/architecture/micro-frontends`
  **Проблема, которую решают** · **Зачем (и закон Конвея)** · **Способы композиции** · Module Federation · App shell · iframe и web components · **Сложности** · **Когда использовать** · **Альтернатива - монорепо** · **Интеграция и общее состояние** · **Способы загрузки** · **Вопросы на собеседовании**
- **16.08 Scalability and teams** — `/content/architecture/scalability-and-teams`
  **Два измерения масштаба** · **Закон Конвея** · **Масштаб кода** · Границы и модульность · Стратегия code splitting · Бюджеты производительности · **Масштаб команд** · Владение · Общий код и платформенная команда · Монорепо · **Согласованность через governance** · **Документация и решения** · **Team Topologies** · **Paved roads и fitness functions** · **Вопросы на собеседовании**
- **16.09 Frontend system design** — `/content/architecture/frontend-system-design`
  **Чем отличается от бэкенд-дизайна** · **Фреймворк RADIO** · R — Requirements · A — Architecture · D — Data model · I — Interface / API · O — Optimizations · **Оси, которые держать в голове** · **Как вести разговор** · **Частые темы** · **Оценки «на салфетке» для фронтенда** · **Не забыть нефункциональное** · **Вопросы на собеседовании**
- **16.10 System design examples** — `/content/architecture/system-design-examples`
  **Пример 1: Автокомплит (typeahead)** · **Пример 2: Новостная лента (бесконечный скролл)** · **Пример 3: Чат** · **Пример 4: Виртуализированная таблица данных** · **Пример 5: Доступный Select / Combobox** · **Общий чеклист** · **Вопросы на собеседовании**
- **16.11 Architectural decisions** — `/content/architecture/architectural-decisions`
  **Всё - компромисс** · **Обратимость решений** · **ADR** · **Технический долг** · **Эволюционная архитектура** · **Принятие решения - процесс** · **Архитектурные характеристики и fitness functions** · **Миграции: strangler fig** · **Senior-мышление** · **Вопросы на собеседовании**

## 17. Security and Performance

- **17.01 Security fundamentals** — `/content/security-perfomance/security-fundamentals`
  **Образ мышления** · **Модель угроз** · **Поверхность атаки фронтенда** · **Триада CIA** · **Принцип наименьших привилегий** · **Никогда не доверяй клиенту - на практике** · **OWASP** · **Secure by default** · **Вопросы на собеседовании**
- **17.02 XSS** — `/content/security-perfomance/xss`
  **Чем опасен** · **Три типа XSS** · Stored (хранимый) · Reflected (отражённый) · DOM-based · **Защита: экранирование** · **Фреймворки экранируют по умолчанию** · **Санитизация** · **Опасные «sinks»** · **URL-инъекции** · **Слои защиты** · **Контексты экранирования** · **Mutation XSS** · **Где ещё прячется XSS** · **Вопросы на собеседовании**
- **17.03 CSRF** — `/content/security-perfomance/csrf`
  **Как работает** · **Защита** · SameSite-куки · CSRF-токены · Double-submit cookie · Кастомные заголовки · Проверка Origin/Referer · **XSS vs CSRF** · **Связь с хранением токена** · **Вопросы на собеседовании**
- **17.04 CORS and same-origin** — `/content/security-perfomance/cors-and-same-origin`
  **Same-Origin Policy** · **Что SOP разрешает и запрещает** · **CORS** · **Как работает CORS** · Простые запросы · Preflight · Credentials · **CORS - это не серверная защита** · **Частые мисконфиги** · **Site vs origin** · **Cross-origin isolation (COOP/COEP/CORP)** · **Opaque-ответы** · **Вопросы на собеседовании**
- **17.05 Authentication and tokens** — `/content/security-perfomance/authentication-and-tokens`
  **Authentication vs authorization** · **Сессии vs токены** · Сессии (stateful) · Токены (stateless, JWT) · Компромиссы · **JWT под капотом** · **Где хранить токен** · **Access + refresh токены** · **OAuth 2.0 и OIDC** · **MFA и passkeys** · **Безопасность сессии** · **Вопросы на собеседовании**
- **17.06 CSP and security headers** — `/content/security-perfomance/csp-and-security-headers`
  **Content-Security-Policy** · **Inline-скрипты: nonce и hash** · **Report-only режим** · **Другие заголовки безопасности** · HSTS · X-Content-Type-Options · **Чья это зона** · **Вопросы на собеседовании**
- **17.07 Supply chain and vulnerabilities** — `/content/security-perfomance/supply-chain-and-vulnerabilities`
  **Supply chain** · Защита · **Секреты на клиенте** · **Clickjacking** · **Prototype pollution** · **Прочие классы** · **Безопасность - это процесс** · **Вопросы на собеседовании**
- **17.08 Performance fundamentals** — `/content/security-perfomance/performance-fundamentals`
  **Зачем это важно** · **Восприятие важнее цифр** · **Сначала измерь** · **Что происходит при загрузке** · **Три рычага** · **Модель RAIL** · **Perf budget** · **Не переусердствуй** · **Вопросы на собеседовании**
- **17.09 Core Web Vitals** — `/content/security-perfomance/core-web-vitals`
  **Три Core Web Vitals** · **LCP - Largest Contentful Paint** · **CLS - Cumulative Layout Shift** · **INP - Interaction to Next Paint** · **Сопутствующие метрики** · **Lab vs Field** · **Как измеряют** · **Вопросы на собеседовании**
- **17.10 Loading performance** — `/content/security-perfomance/loading-performance`
  **Критический путь рендеринга** · **Блокирующие ресурсы** · Critical CSS · **Resource hints** · **Грузить меньше и позже** · **Сжатие** · **HTTP/2 и HTTP/3** · **Серверный рендеринг** · **Back/forward cache (bfcache)** · **Early Hints и Speculation Rules** · **Вопросы на собеседовании**
- **17.11 Runtime performance** — `/content/security-perfomance/runtime-performance`
  **Главный поток** · **Бюджет кадра: 16мс** · **Длинные задачи** · **Конвейер рендеринга** · Анимируй transform и opacity · Layout thrashing · **Debounce и throttle** · **Виртуализация** · **Web Workers** · **Меньше лишней работы** · **content-visibility и will-change** · **Память** · **Вопросы на собеседовании**
- **17.12 Asset optimization** — `/content/security-perfomance/asset-optimization`
  **Изображения** · Современные форматы · Адаптивные изображения · Прочее · **Шрифты** · **JS и CSS** · **Видео** · **Где самый большой выигрыш** · **Вопросы на собеседовании**
- **17.13 Caching strategies** — `/content/security-perfomance/caching-strategies`
  **Слои кеширования** · **HTTP-кеш браузера** · **CDN и edge** · **Service Worker** · **Prefetching** · **Инвалидация** · **Кеш данных приложения** · **Вопросы на собеседовании**
- **17.14 Measuring and monitoring** — `/content/security-perfomance/measuring-and-monitoring`
  **Лабораторные инструменты** · **Lab vs field - снова** · **Полевые данные (RUM)** · **Бюджеты производительности в CI** · **Мониторинг в проде** · **Рабочий цикл** · **Связь обеих половин** · **Вопросы на собеседовании**

## 18. Preparing for interviews

- **18.01 Resume** — `/content/preparing-for-interviews/resume` · по стандарту
  **Что ищет рекрутер** · **Структура** · **Пункты с результатом** · Где взять цифры · Масштаб и влияние · **Под вакансию** · **Системы отбора** · **Длина и навыки** · **Профиль и портфолио** · **Красные флаги в резюме**
- **18.02 Platforms** — `/content/preparing-for-interviews/platforms` · по стандарту
  **Каналы** · **Рекомендации** · Как попросить · Сеть строят заранее · **Входящие предложения** · **Типы компаний** · Что выяснить о компании · **Список целевых компаний** · **Красные флаги**
- **18.03 Apply tricks** — `/content/preparing-for-interviews/apply-tricks` · по стандарту
  **Воронка** · **Сначала рекомендация** · **Под вакансию** · **Сопроводительное сообщение** · **Время и прямой контакт** · **Учёт** · **Параллельные процессы** · Лучшая альтернатива · **Объём и качество** · **Отказы и тишина** · **Тревожные признаки в вакансии** · **Красные флаги в подходе**
- **18.04 HR screening** — `/content/preparing-for-interviews/hr-screening` · по стандарту
  **Что проверяет рекрутер** · **Расскажите о себе** · **Почему уходите и почему мы** · **Деньги** · Пакет целиком · **Уровень роли** · **Свои вопросы** · **Подготовка к звонку** · **Красные флаги**
- **18.05 Technical interview** — `/content/preparing-for-interviews/technical-interview` · по стандарту
  **Форматы** · **Живой кодинг шаг за шагом** · 1. Уточнить требования · 2. Проговорить план · 3. Простое рабочее решение · 4. Думать вслух · 5. Проверить · 6. Обсудить улучшения · **Если застрял** · **Сборка компонента** · **Домашнее задание** · **Проектирование системы** · **Что оценивают** · **Подготовка** · **Красные флаги**
- **18.06 Behavioral interview** — `/content/preparing-for-interviews/behavioral-interview` · по стандарту
  **Что оценивают** · **STAR** · Разобранный пример · **Банк историй** · Частые вопросы · **Ошибка** · **Конфликт** · **Масштаб историй** · **Тон** · **Красные флаги**
- **18.07 Final interview** — `/content/preparing-for-interviews/final-interview` · по стандарту
  **Что происходит на финале** · **Разговор с нанимающим менеджером** · **Вопросы к компании** · Нанимающему менеджеру · Команде · Смежным ролям · **Оценить команду и руководителя** · **На что смотреть, кроме денег** · **Закрепить впечатление** · **Подготовка** · **Красные флаги**
- **18.08 Follow ups** — `/content/preparing-for-interviews/follow-ups` · по стандарту
  **Напоминание о себе** · **Оценка предложения** · Пример сравнения · **Переговоры** · Почему стоит торговаться · Порядок · Что сказать · Кроме оклада · Несколько предложений · **Отказ компании** · **Если отказали тебе** · **Принятие и уход** · **Красные флаги**

## 19. Common coding questions

- **19.01 Introduction** — `/content/common-coding-questions/introduction`
  **Что такое фронтенд-раунд** · **Алгоритмы vs фронтенд-задачи** · **Что проверяют на самом деле** · **Как подходить к любой задаче** · **Форматы, в которых это встречается** · **Что будет дальше** · **Вопросы на собеседовании**
- **19.02 Higher-order utils** — `/content/common-coding-questions/higher-order-utils`
  **debounce** · **throttle** · **curry** · **memoize** · **compose и pipe** · **once** · **Вопросы на собеседовании**
- **19.03 Deep operations** — `/content/common-coding-questions/deep-operations`
  **deepClone** · **deepEqual** · **flatten массива** · **flatten объекта** · **get / set по пути (lodash-style)** · **Вопросы на собеседовании**
- **19.04 Function polyfills** — `/content/common-coding-questions/function-polyfills`
  **call** · **apply** · **bind** · **new** · **instanceof** · **Object.create и наследование** · **Вопросы на собеседовании**
- **19.05 Array polyfills** — `/content/common-coding-questions/array-polyfills`
  **map** · **filter** · **reduce** · **forEach** · **Array.flat** · **groupBy** · **unique (дедупликация)** · **Вопросы на собеседовании**
- **19.06 Promises and async** — `/content/common-coding-questions/promises-async`
  **Promise.all** · **Promise.allSettled** · **Promise.race и Promise.any** · **promisify** · **sleep и retry** · **Ограничение конкурентности (mapLimit)** · **Очередь задач (async series)** · **Вопросы на собеседовании**
- **19.07 Implement Promise** — `/content/common-coding-questions/implement-promise`
  **Три состояния** · **Минимальное ядро** · **then с цепочками** · **catch и finally через then** · **Почему именно микротаска** · **Статические методы** · **Простой планировщик задач (бонус)** · **Вопросы на собеседовании**
- **19.08 Events and pub/sub** — `/content/common-coding-questions/events-and-pubsub`
  **EventEmitter** · **Pub/Sub (шина событий)** · **Observable (мини-реактивность)** · **Простой Store (Redux-lite)** · **Вопросы на собеседовании**
- **19.09 DOM tasks** — `/content/common-coding-questions/dom-tasks`
  **Делегирование событий** · **Свой getElementsByClassName** · **Обход дерева DOM** · **classNames (утилита cn)** · **Свой querySelector (упрощённый)** · **Вопросы на собеседовании**
- **19.10 UI components: basics** — `/content/common-coding-questions/ui-components-basics`
  **Что оценивают в machine-coding** · **Tabs (табы)** · **Accordion (аккордеон)** · **Modal (модальное окно)** · **Star rating (рейтинг)** · **Stopwatch / Timer (секундомер)** · **OTP input (код из ячеек)** · **Вопросы на собеседовании**
- **19.11 UI components: advanced** — `/content/common-coding-questions/ui-components-advanced`
  **Autocomplete / Typeahead** · **Бесконечный скролл** · **Пагинация** · **Todo (mini-app)** · **Tic-tac-toe (крестики-нолики)** · **Вопросы на собеседовании**
- **19.12 Framework implementation** — `/content/common-coding-questions/framework-implementation`
  **signal / effect / computed** · **Vue ref и reactive** · **Хуки React (useState с нуля)** · **Кастомные хуки** · **Teleport / createPortal** · **Мини-VDOM и render** · **Мини-фреймворк (всё вместе)** · **Вопросы на собеседовании**
- **19.13 Caching and state** — `/content/common-coding-questions/caching-and-state`
  **LRU Cache** · **Rate limiter** · **Мемоизированный селектор** · **Мини-стор с подпиской** · **Вопросы на собеседовании**
- **19.14 Tricky and output** — `/content/common-coding-questions/tricky-and-output`
  **Порядок event loop** · **Замыкания в цикле** · **this и контекст вызова** · **Hoisting и TDZ** · **Приведение типов** · **Reference vs value** · **Вопросы на собеседовании**
- **19.15 How to approach** — `/content/common-coding-questions/how-to-approach`
  **Универсальный алгоритм решения** · **Уточняющие вопросы** · **Думай вслух** · **Сложность не забывается** · **Частые ошибки** · **Чеклист перед «готово»** · **Куда дальше** · **Вопросы на собеседовании**

## 20. Final steps

- **20.01 Continuous learning** — `/content/final-steps/continuous-learning` · по стандарту
  **Принципы, а не синтаксис** · Как отличить принцип от синтаксиса · **Глубина и ширина** · **Как знание закрепляется** · Извлечение сильнее перечитывания · Объяснение · Постройка · Ловушка туториалов · **Учиться с ИИ** · **Новинки без выгорания** · Фильтр · Новое — часто переупаковка · Источники · **Система на неделю** · Устойчивый темп
- **20.02 Career growth** — `/content/final-steps/career-growth` · по стандарту
  **Уровни** · **Две траектории** · **Как получают повышение** · Работать на следующем уровне · Влияние, а не активность · Документ о своих результатах · **Видимость** · Клеевая работа · **Разговоры с руководителем** · **Новое место** · **Присутствие и сеть** · **Своя цена**
- **20.03 Engineering maturity** — `/content/final-steps/engineering-maturity` · по стандарту
  **Код — базовый уровень** · **Коммуникация** · **Письмо как инструмент** · Дизайн-документ · Запись о решении · Документация и README · **Ревью** · Давать ревью · Получать ревью · **Решения** · Компромиссы, а не идеал · Обратимость · Достаточно хорошо · **Владение результатом** · Ошибки и инциденты · **Неопределённость** · **Растить других** · **Скромность и устойчивость**
- **20.04 Final words** — `/content/final-steps/final-words` · по стандарту
  **Путь, который ты прошёл** · **Что важнее всего** · **Кто такой Frontend Legend** · **Как пользоваться книгой дальше** · Перед собеседованием · В работе · Чтобы не забыть · Чтобы понять по-настоящему · **От автора** · **Куда дальше**
