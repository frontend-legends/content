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
- **7.02 Types and Variables** — `/content/javascript/types-and-variables`
  **Примитивные типы** · string · number · bigint · boolean · undefined · null · symbol · **Ссылочные типы (Object)** · **typeof** · **Переменные: var vs let vs const** · **Temporal Dead Zone (TDZ)** · **Hoisting** · **Приведение типов (Type Coercion)** · Явное приведение (explicit) · Неявное приведение (implicit) · **Сравнение: == vs ===** · === (строгое равенство) · == (нестрогое равенство) · **Truthy и Falsy** · Falsy-значения (полный список) · Всё остальное - truthy · **Boxing / Unboxing** · **Nullish Coalescing (??) vs OR (||)** · **Методы строк** · **Number подробно** · **valueOf() и toString()** · **instanceof** · **null vs undefined** · **Tagged template literals** · **Частые вопросы на собесе**
- **7.03 Objects and Arrays** — `/content/javascript/objects-and-arrays`
  **Объекты** · Создание объектов · Доступ к свойствам · **Методы Object** · **Spread и копирование объектов** · **Деструктуризация объектов** · **Массивы** · Создание и доступ · **Методы массивов** · Мутирующие методы · Немутирующие методы · Новые немутирующие копии (ES2023) · **Spread и деструктуризация массивов** · **Map** · Map vs Object · **Set** · Set operations (ES2025) · **WeakMap и WeakSet** · **TypedArrays и ArrayBuffer** · **Циклы в JavaScript** · **Паттерны работы с массивами** · **Дополнительные методы объектов** · **Частые вопросы на собесе**
- **7.04 Functions** — `/content/javascript/functions`
  **Function Declaration vs Function Expression vs Arrow Function** · Function Declaration · Function Expression · Arrow Function · Таблица различий · **Параметры функций** · Default values · Rest parameters (...args) · Destructuring в параметрах · **Объект arguments** · **Return value** · Explicit return · Implicit return (только arrow functions) · Без return · **IIFE - Immediately Invoked Function Expression** · Зачем нужен IIFE · Варианты синтаксиса · **First-class functions** · **Higher-Order Functions** · map, filter, reduce - классические примеры · Написать свой HOF · Цепочки (chaining) · **Рекурсия** · Обход дерева - типичный кейс · Tail Call Optimization (TCO) · **Generator functions** · **Async-функции** · **Конструктор Function** · **Сравнение всех типов функций** · **Arrow vs обычная функция** · **Частые вопросы на собесе**
- **7.05 Execution Context** — `/content/javascript/execution-context`
  **Что такое Execution Context** · Три типа контекстов · **Фазы контекста выполнения** · 1. Creation Phase (фаза создания) · 2. Execution Phase (фаза выполнения) · **Variable Environment и Lexical Environment** · **Scope** · Глобальный scope · Функциональный scope · Блочный scope · **Scope Chain** · **Hoisting** · var · function declaration · let и const - Temporal Dead Zone (TDZ) · class · Таблица hoisting · **this** · Default binding · Implicit binding · Explicit binding - call, apply, bind · new binding · Arrow function - лексический this · **Приоритет привязок this** · **Потеря контекста** · Ситуация 1 - передача метода как callback · Ситуация 2 - деструктуризация метода · Решения · **Частые вопросы на собесе**
- **7.06 Closures** — `/content/javascript/closures`
  **Что такое замыкание** · **Лексическая область видимости** · **Как замыкание работает** · **Примеры замыканий** · Counter - классический пример · Private state и Module pattern · Каррирование через замыкания · Event handlers и замыкания · **Замыкания в цикле - классическая ловушка** · Решение 1 - let · Решение 2 - IIFE · Решение 3 - дополнительная функция · **Практические use cases** · Debounce · Throttle · Memoization · Partial application · Factory functions · **Замыкания и утечки памяти** · Когда это проблема · Решения · **Замыкания на собеседовании** · Задача 1 - counter · Задача 2 - closure in loop · Задача 3 - private variable · Задача 4 - что выведет? · **Частые вопросы на собесе**
- **7.07 Prototypes and Classes** — `/content/javascript/prototypes-and-classes`
  **Прототипное наследование** · __proto__ vs prototype · **Prototype chain** · Запись свойства не затрагивает прототип · hasOwnProperty и in · **Object.create()** · **Constructor functions (до ES6)** · Что делает new · **ES6 Classes** · Методы · **Наследование - extends и super** · Prototype chain с классами · **Private fields и methods** · **Getters и setters** · В классах · В объектных литералах · **instanceof и проверка типов** · Другие способы проверки · **Mixins** · Mixin через функцию (более гибкий подход) · **Class vs prototype - под капотом** · Но есть отличия · **Сравнительная таблица** · **Разница между [[Prototype]], __proto__ и .prototype** · **Абстрактные классы** · **Частые вопросы на собесе**
- **7.08 Event Loop** — `/content/javascript/event-loop`
  **Однопоточность JavaScript** · **Call Stack** · Stack Overflow · **Web APIs и Node APIs** · **Очереди задач** · Macrotask Queue (Task Queue) · Microtask Queue · Ключевое различие · **Алгоритм Event Loop** · **Порядок выполнения - примеры** · Пример 1 - базовый · Пример 2 - вложенные microtasks · Пример 3 - async/await · Пример 4 - комплексный · **requestAnimationFrame** · Место в Event Loop · **requestIdleCallback** · **setTimeout(fn, 0) - почему не мгновенно?** · **Node.js Event Loop** · Ключевые отличия от браузера · process.nextTick vs queueMicrotask в Node.js · setTimeout vs setImmediate в Node.js · **queueMicrotask vs Promise.resolve().then()** · **Визуализация полного цикла** · **Что происходит, когда Event Loop пуст** · **setInterval: особенности** · **Частые вопросы на собесе**
- **7.09 Async** — `/content/javascript/async`
  **Зачем нужна асинхронность** · **Callbacks** · Error-first convention (Node.js style) · Callback Hell · **Promises** · Три состояния · Создание Promise · Цепочки - then, catch, finally · Promise combinators · Сравнительная таблица combinators · Promise.resolve и Promise.reject · Частые ошибки с Promises · **async/await** · Базовый синтаксис · Как работает await · Error handling в async/await · Параллельные vs последовательные запросы · Top-level await · **Паттерны асинхронного кода** · Sequential execution - когда порядок важен · Parallel execution с контролем · for await...of - async iteration · AbortController - отмена асинхронных операций · **Эволюция асинхронности в JS** · **Промис, который никогда не завершится** · **Race conditions** · **Частые вопросы на собесе**
- **7.10 Error Handling** — `/content/javascript/error-handling`
  **try/catch/finally** · Порядок выполнения · finally и return · Опциональный catch binding · **Объект Error** · Stack trace · **Встроенные типы ошибок** · **Custom Errors** · Использование · Проверка типа ошибки · **throw - что можно бросать** · **Ошибки в асинхронном коде** · Promise rejection · Unhandled rejection · Глобальные обработчики ошибок · **Error Boundaries (React pattern)** · **Паттерны обработки ошибок** · Fail fast · Graceful degradation · Error wrapping - добавление контекста · Centralized error handling · **Антипаттерны** · Пустой catch · try/catch для control flow · Catch and rethrow без причины · **Частые вопросы на собесе**
- **7.11 Modules** — `/content/javascript/modules`
  **Зачем модули** · **До модулей - как жили раньше** · Глобальные переменные · IIFE (Immediately Invoked Function Expression) · Namespace pattern · **CommonJS (CJS)** · Синтаксис · Default export в CommonJS · Как работает require · **ES Modules (ESM)** · Синтаксис · Default export · Named exports vs default export · Import alias · Namespace import · **CJS vs ESM - сравнение** · **Re-exports** · **Dynamic imports** · Code splitting · **Import attributes** · **Circular dependencies - циклические зависимости** · В CommonJS · В ESM · Как избежать циклических зависимостей · **Tree Shaking** · Почему не работает с CommonJS · sideEffects в package.json · **Module Scope** · **Модули в браузере - type="module"** · Отличия type="module" от обычного script · **Частые вопросы на собесе**
- **7.12 Iterators and Generators** — `/content/javascript/iterators-and-generators`
  **Iteration Protocol** · **Встроенные iterable объекты** · **for...of vs for...in** · **Генераторы** · **yield и двусторонняя коммуникация** · **yield* - делегирование** · **Методы генератора** · **Async Generators** · **Практические use cases генераторов** · **Частые вопросы на собесе**
- **7.13 Metaprogramming** — `/content/javascript/metaprogramming`
  **Proxy** · Синтаксис · Основные traps · Пример: валидация при записи · Пример: логирование доступа · Reactive data (как Vue 3) · Revocable Proxy · **Reflect API** · Основные методы · Почему Reflect вместо прямого доступа · **Symbol** · Создание · Global Symbol Registry · Symbol как ключи объектов · Well-known Symbols · **WeakMap** · Отличия от Map · Практические use cases · **WeakSet** · **WeakRef и FinalizationRegistry** · WeakRef · FinalizationRegistry · Пример: кэш с WeakRef · **Когда использовать что** · **Частые вопросы на собесе**
- **7.14 Patterns** — `/content/javascript/patterns`
  **Функциональные паттерны** · Pure functions · Immutability · Currying · Partial application · Compose и pipe · Higher-order functions · **Event-driven паттерны** · EventEmitter · Pub/Sub · Observer · Observer vs Pub/Sub · **Другие полезные паттерны** · Module pattern · Singleton · Factory function vs constructor · Strategy pattern · Middleware pattern · **Частые вопросы на собесе**
- **7.15 Memory and Performance** — `/content/javascript/memory-and-performance`
  **Как JS управляет памятью** · **Garbage Collector в V8** · Mark-and-Sweep · Generational GC в V8 · Incremental и concurrent marking · **Типичные утечки памяти** · Глобальные переменные · Забытые таймеры · Event listeners без removeEventListener · Closures, удерживающие большие объекты · Detached DOM nodes · React-специфичные утечки · **Как находить утечки** · Memory tab - основные инструменты · Методика поиска утечки · Retained size vs Shallow size · **Performance API** · performance.now() · performance.mark() и performance.measure() · PerformanceObserver · **Оптимизация** · Debounce и throttle · Virtual scrolling · Web Workers · requestAnimationFrame · **Частые вопросы на собесе**
- **7.16 Modern JS** — `/content/javascript/modern-js`
  **ES2020** · Optional chaining - ?. · Nullish coalescing - ?? · Другие фичи ES2020 · **ES2021** · **ES2022** · Top-level await · Array.at() · Другие фичи ES2022 · **ES2023** · Change Array by copy · Array find from last · Hashbang · **ES2024** · **ES2025** · **ES2026 и что дальше** · **JSON** · JSON.parse() и JSON.stringify() · Replacer и reviver · Prettify и toJSON · structuredClone() vs JSON deep copy · **Intl API** · Intl.NumberFormat · Intl.DateTimeFormat · Intl.RelativeTimeFormat · Intl.PluralRules и Intl.Segmenter · **Date и Temporal** · Проблемы Date · Temporal proposal · **Частые вопросы на собесе**

## 8. TypeScript

- **8.01 Introduction** — `/content/typescript/introduction`
  **Что такое TypeScript** · **Ключевые характеристики** · **Как работает TypeScript** · **Преимущества** · **Недостатки** · **Structural typing (Duck typing)** · **Type inference** · **Type annotations** · **Type assertion** · **Инструменты** · **Частые вопросы на собесе**
- **8.02 Basic Types** — `/content/typescript/basic-types`
  **Примитивные типы** · **null и undefined** · **symbol и bigint** · **Специальные типы** · any · unknown · never · void · Сравнительная таблица · **Literal types** · **Enum** · Gotchas с enum · Альтернатива enum - as const объект · **Объекты** · **Массивы** · **Tuples** · **as const** · **satisfies** · **Частые вопросы на собесе**
- **8.03 Functions and Classes** — `/content/typescript/functions-and-classes`
  **Типизация функций** · **Optional и default параметры** · **Rest параметры** · **Function overloads** · **Типизация callback-ов** · **void vs undefined** · **Параметр this** · **Function type expressions** · **Классы в TypeScript** · Property declarations · Constructor parameter shorthand · **Модификаторы видимости** · **readonly свойства** · **Абстрактные классы** · **implements** · **Static members** · **Decorators** · **Частые вопросы на собесе**
- **8.04 Composing Types** — `/content/typescript/composing-types`
  **Union Types - объединение** · **Intersection Types - пересечение** · **Type Aliases - псевдонимы типов** · **Interfaces - интерфейсы** · **Type vs Interface - сравнение** · **Index Signatures - индексные подписи** · **Операторы типов** · keyof - получение ключей · typeof в контексте типов · Indexed Access Types · **Module Augmentation - расширение сторонних типов** · **Частые вопросы на собесе**
- **8.05 Type Narrowing** — `/content/typescript/type-narrowing`
  **typeof guards** · **instanceof guards** · **Оператор in** · **Truthiness narrowing** · **Equality narrowing** · **Discriminated Unions - размеченные объединения** · Практический пример - ответ API · **Custom Type Guards - пользовательские защитники типов** · **Assertion Functions - функции-утверждения** · **Exhaustive Checking с never** · **Частые вопросы на собесе**
- **8.06 Generics** — `/content/typescript/generics`
  **Зачем нужны дженерики** · **Базовый синтаксис** · **Стрелочные функции и TSX** · **Generic Interfaces** · **Generic Type Aliases** · **Generic Classes** · **Constraints - ограничения** · **keyof Constraint** · **Default Type Parameters** · **Multiple Type Parameters** · **Const Type Parameters (TS 5.0+)** · **Практические паттерны** · Generic API Response · Generic Event Handler · Generic Factory · **Частые вопросы на собесе**
- **8.07 Utility Types** — `/content/typescript/utility-types`
  **Трансформация объектов** · Partial - все свойства становятся optional · Required - все свойства становятся обязательными · Readonly - все свойства только для чтения · **Выбор и исключение свойств** · Pick - выбрать конкретные свойства · Omit - исключить свойства · **Record - объект с типизированными ключами и значениями** · **Манипуляции с union-типами** · Exclude - исключить типы из union · Extract - извлечь типы из union · NonNullable - убрать null и undefined · **Утилиты для функций** · Parameters - типы параметров функции · ReturnType - тип возвращаемого значения · ConstructorParameters - параметры конструктора · InstanceType - тип экземпляра класса · **Работа с Promise** · Awaited - unwrap типа Promise · **Строковые утилиты** · **Практические примеры** · Типизированная функция обновления через API · Конфиг через Record · Состояние формы с Pick и Omit · **Таблица всех utility types** · **Частые вопросы на собесе**
- **8.08 Advanced Types** — `/content/typescript/advanced-types`
  **Mapped types** · Базовый синтаксис · Все свойства optional - так работает Partial · Модификаторы: readonly, ?, +/- · Key remapping - переименование ключей · **Conditional types** · Базовый синтаксис · Практический пример · **Ключевое слово infer** · Извлечение типа элемента массива · Так работает ReturnType · Вложенный infer - извлечение типа из Promise · Извлечение аргументов из события · **Distributive conditional types** · Как работает распределение · Как предотвратить распределение · **Template literal types** · Базовый синтаксис · Типизированные CSS-свойства · Типизированные роуты · **Рекурсивные типы** · DeepPartial - рекурсивный Partial · Рекурсивный тип JSON · DeepReadonly · **Branded types (номинальная типизация)** · Типобезопасные ID · **Сводная таблица продвинутых техник** · **Частые вопросы на собесе**
- **8.09 Project Setup** — `/content/typescript/project-setup`
  **Структура tsconfig.json** · **Ключевые опции компилятора** · target - целевая версия JavaScript · module - система модулей · lib - доступные API · moduleResolution - как искать модули · esModuleInterop · jsx · Пути: outDir, rootDir, baseUrl, paths · **Strict mode** · Что включает strict: true · strictNullChecks - самый важный флаг · noImplicitAny · strictPropertyInitialization · **Declaration files (.d.ts)** · Что это такое · Написание .d.ts для JS-библиотеки · declare keyword · **DefinitelyTyped и @types** · **ESM vs CJS в TypeScript** · Node.js с ESM · **Инструменты сборки** · tsc - компилятор TypeScript · Быстрые альтернативы · **Project references** · **Частые вопросы на собесе**
- **8.10 Async and DOM** — `/content/typescript/async-and-dom`
  **Типизация Promise** · **Awaited - разворачиваем вложенные промисы** · **Generic fetch wrapper** · **Typed API client** · **Иерархия DOM-типов** · Основные DOM-типы · **document.querySelector и типизация** · **Типизация событий** · addEventListener · **AbortController** · **Типизация ответов axios** · **Частые вопросы на собесе**
- **8.11 TS with React** — `/content/typescript/ts-with-react`
  **Типизация компонентов** · **Props interface** · Типы для children · **useState** · **useRef** · **useReducer** · **useContext** · **Event handlers** · **Generic-компоненты** · **forwardRef** · **Polymorphic "as" prop** · **Частые ошибки** · **Частые вопросы на собесе**
- **8.12 TS with Vue** — `/content/typescript/ts-with-vue`
  **Setup: script setup lang="ts"** · **defineProps** · **defineEmits** · **defineModel (Vue 3.4+)** · **ref() и типизация** · **reactive() и computed()** · **Composables** · **Template refs** · **provide / inject** · **Pinia store** · **Component instance type** · **Частые вопросы на собесе**

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

- **10.01 Introduction** — `/content/vuejs/introduction`
  **Декларативность и реактивность** · **Single-File Components** · **Два API: Composition и Options** · **История** · **Vue vs React vs Angular** · **Что входит в экосистему** · **Вопросы на собеседовании**
- **10.02 Templates and directives** — `/content/vuejs/templates-and-directives`
  **Интерполяция и привязки** · **Условный рендеринг: v-if vs v-show** · **Списки: v-for и key** · **Привязка классов и стилей** · **Модификаторы директив** · **v-model** · **Динамические компоненты** · **Кастомные директивы** · **Шаблоны vs JSX** · **Вопросы на собеседовании**
- **10.03 Reactivity fundamentals** — `/content/vuejs/reactivity-fundamentals`
  **ref и reactive** · **Зачем .value** · **Как работает реактивность** · **Vue 2 vs Vue 3: почему Proxy** · **Подводные камни реактивности** · 1. Деструктуризация reactive теряет реактивность · 2. Переприсваивание reactive рвёт связь · 3. reactive не работает с примитивами · 4. ref внутри reactive разворачивается · **Тонкости разворачивания ref** · **ref или reactive: что выбирать** · **Сравнение с React** · **Вопросы на собеседовании**
- **10.04 Composition API** — `/content/vuejs/composition-api`
  **script setup** · **Функция setup() под капотом** · **Хуки жизненного цикла** · Карта жизненного цикла · **Компиляторные макросы** · **Options API (legacy-теория)** · **Почему Composition победил** · Mixins как legacy · **Когда что использовать** · **Вопросы на собеседовании**
- **10.05 Computed and watchers** — `/content/vuejs/computed-and-watchers`
  **computed - кэшируемое производное значение** · computed vs метод · Writable computed · **watch - явное наблюдение** · Опции watch · **watchEffect - автоматические зависимости** · **watch vs watchEffect** · **Время срабатывания (flush)** · **Остановка наблюдателей** · **Что выбрать** · **Вопросы на собеседовании**
- **10.06 Components communication** — `/content/vuejs/components-communication`
  **Props - данные вниз** · **Emits - события вверх** · **v-model на компонентах** · defineModel (Vue 3.4+) · Несколько v-model и аргументы · **Fallthrough-атрибуты** · **Способы обмена данными - сводка** · **Вопросы на собеседовании**
- **10.07 Slots** — `/content/vuejs/slots`
  **Дефолтный слот** · Запасное содержимое · **Именованные слоты** · **Scoped slots - данные из компонента в слот** · **Renderless-компоненты** · **Динамические имена слотов** · **Слоты vs React** · **Вопросы на собеседовании**
- **10.08 Provide / Inject** — `/content/vuejs/provide-inject`
  **Проблема prop drilling** · **Как работает** · **Реактивность инъекций** · **Injection keys и значения по умолчанию** · **Уровень приложения** · **Сравнение с React Context** · **Когда использовать** · **Вопросы на собеседовании**
- **10.09 Composables** — `/content/vuejs/composables`
  **Что это и зачем** · **Конвенции** · Принимай и значения, и ref'ы · **Composables vs кастомные хуки React** · **Composables vs mixins (legacy)** · **Композиция composables** · **VueUse** · **Вопросы на собеседовании**
- **10.10 Reactivity advanced** — `/content/vuejs/reactivity-advanced`
  **shallowRef и shallowReactive** · **readonly** · **toRaw и markRaw** · **customRef** · **effectScope** · **nextTick** · **toRef / toRefs / toValue - напоминание** · **Вопросы на собеседовании**
- **10.11 Built-in components** — `/content/vuejs/built-in-components`
  **Teleport - рендер в другое место DOM** · **Suspense - ожидание асинхронного** · **KeepAlive - кэш переключаемых компонентов** · **Асинхронные компоненты** · **Transition и TransitionGroup** · **Сводка** · **Вопросы на собеседовании**
- **10.12 State management** — `/content/vuejs/state-management`
  **Таксономия состояния** · **Лестница решений** · **Pinia** · Setup-стор (рекомендуется) · Options-стор · Использование · **Pinia vs Vuex (legacy)** · **Реактивность вместо селекторов** · **Вопросы на собеседовании**
- **10.13 Data fetching** — `/content/vuejs/data-fetching`
  **Почему server state особенный** · **Наивная загрузка и её проблемы** · **TanStack Query (Vue Query)** · **Кэш и инвалидация** · **Suspense для async setup** · **Загрузка в Nuxt** · **Водопады запросов** · **Вопросы на собеседовании**
- **10.14 Routing** — `/content/vuejs/routing`
  **SPA-роутинг кратко** · **Vue Router** · **Доступ к маршруту** · **Вложенные маршруты** · **Навигационные guard'ы** · **Ленивые маршруты** · **URL как состояние** · **Роутинг в Nuxt** · **Вопросы на собеседовании**
- **10.15 Performance** — `/content/vuejs/performance`
  **Что Vue оптимизирует сам** · **v-once** · **v-memo** · **computed-кэш** · **KeepAlive** · **Code splitting** · **Виртуализация списков** · **Реактивность под нагрузкой** · **Vapor mode** · **Профайлинг** · **Чеклист** · **Вопросы на собеседовании**
- **10.16 Security** — `/content/vuejs/security`
  **XSS и автоэкранирование** · **v-html** · **Инъекции через URL** · **Не компилируй пользовательские шаблоны** · **Секреты не живут на клиенте** · **Прочее** · **Вопросы на собеседовании**
- **10.17 Rendering and Nuxt** — `/content/vuejs/rendering-and-nuxt`
  **Стратегии рендеринга** · **SSR во Vue** · **Гидратация** · Hydration mismatch · **Nuxt** · **Режимы рендеринга Nuxt** · **Islands и серверные компоненты** · **Как выбрать** · **Вопросы на собеседовании**
- **10.18 Testing Vue** — `/content/vuejs/testing-vue`
  **Философия: behavior over implementation** · **Vue Test Utils** · Проверка событий · Props и v-model · **Testing Library для Vue** · **Асинхронность** · **Тестирование composables** · **Моки и сеть** · **Пирамида тестов** · **Вопросы на собеседовании**

## 11. Advanced Tooling

- **11.01 Introduction** — `/content/advanced-tooling/introduction`
  **Зачем вообще нужен тулинг** · **Конвейер сборки** · **Dev vs prod** · **Из чего состоит тулчейн** · **«Zero-config» и почему он не магия** · **Вопросы на собеседовании**
- **11.02 Module systems** — `/content/advanced-tooling/module-systems`
  **Зачем модули** · **CommonJS (CJS)** · **ES Modules (ESM)** · **Главное различие: статика vs динамика** · **Named vs default** · **Динамический import()** · **UMD** · **Разрешение модулей** · **Боль interop (ESM ↔ CJS)** · **Tree-shakeability - сводка** · **Вопросы на собеседовании**
- **11.03 Bundlers** — `/content/advanced-tooling/bundlers`
  **Зачем бандлить** · **Как работает бандлер** · **Базовые понятия** · **Ландшафт** · Webpack · Rollup · esbuild · **Бандлер приложения vs библиотеки** · **Vite** · **Вопросы на собеседовании**
- **11.04 Vite and dev servers** — `/content/advanced-tooling/vite-and-dev-servers`
  **Старая проблема** · **Идея Vite** · **Архитектура dev-режима** · 1. Пребандлинг зависимостей (esbuild) · 2. Отдача исходников по требованию · **HMR - Hot Module Replacement** · **Prod-сборка** · **Другие функции dev-сервера** · **Vite vs webpack-dev-server** · **Вопросы на собеседовании**
- **11.05 Transpilation** — `/content/advanced-tooling/transpilation`
  **Что это и зачем** · **Как работает** · **Транспиляция vs полифил** · **Targets и browserslist** · **Инструменты** · Babel · SWC и esbuild · **Главная ловушка: они НЕ проверяют типы** · **AST и кодмоды** · **Вопросы на собеседовании**
- **11.06 TypeScript tooling** — `/content/advanced-tooling/typescript-tooling`
  **Две роли tsc** · **Современное разделение** · **isolatedModules** · **Ключевые опции tsconfig** · **Проверка типов в CI** · **Генерация .d.ts** · **Project references** · **Language Server** · **Вопросы на собеседовании**
- **11.07 Optimization** — `/content/advanced-tooling/optimization`
  **Минификация** · **Tree-shaking** · **Code splitting** · **Scope hoisting** · **Хеширование и кеш** · **Сжатие** · **Source maps** · **Когда tree-shaking не срабатывает** · **Анализ бандла** · **Ассеты** · **Вопросы на собеседовании**
- **11.08 Linting and formatting** — `/content/advanced-tooling/linting-and-formatting`
  **Линтер ≠ форматтер** · **ESLint** · **Prettier** · **Biome и новое поколение** · **Stylelint** · **Интеграция** · **Кастомные правила** · **Вопросы на собеседовании**
- **11.09 Git hooks and quality gates** — `/content/advanced-tooling/git-hooks-and-quality-gates`
  **Что такое git-хуки** · **husky** · **lint-staged** · **Conventional Commits и commitlint** · **Оборона в глубину** · **Что куда** · **Вопросы на собеседовании**
- **11.10 CI/CD** — `/content/advanced-tooling/ci-cd`
  **CI и CD** · **Пайплайн фронтенда** · **GitHub Actions** · **Фронтенд-специфичные гейты** · **Ускорение пайплайна** · **Branch protection** · **Превью-деплои** · **CD** · **Вопросы на собеседовании**
- **11.11 Monorepo tooling** — `/content/advanced-tooling/monorepo-tooling`
  **Монорепо vs полирепо** · **Workspaces - основа** · **Проблема масштаба** · **Оркестраторы задач** · Turborepo · Nx · **Кеширование задач** · **Affected / инкрементальность** · **Внутренние пакеты** · **Когда монорепо** · **Вопросы на собеседовании**
- **11.12 DevTools and debugging** — `/content/advanced-tooling/devtools-and-debugging`
  **Панели Chrome DevTools** · **Network** · **Performance** · **Memory** · **Application** · **Отладка с брейкпоинтами** · **Source maps в отладке** · **DevTools фреймворков** · **Console - больше, чем log** · **Lighthouse** · **Вопросы на собеседовании**
- **11.13 Rust and the future** — `/content/advanced-tooling/rust-and-the-future`
  **Почему JS-тулинг был медленным** · **Почему Go и Rust** · **Пионер: esbuild** · **Волна Rust** · **Консолидация: единые тулчейны** · **Компромиссы** · **Связь с главой** · **Вопросы на собеседовании**

## 12. Ecosystem libs

- **12.01 Introduction** — `/content/ecosystem-libs/introduction`
  **Build vs buy** · **Критерии выбора библиотеки** · **Размер бандла и tree-shaking** · **Красные флаги** · **ESM vs CommonJS** · **Усталость от экосистемы** · **Наблюдаемость - в двух словах** · **Вопросы на собеседовании**
- **12.02 Package management** — `/content/ecosystem-libs/package-management`
  **Менеджеры пакетов** · **package.json - ключевые поля** · Типы зависимостей · **Semver** · **Lockfile** · **npx и dlx** · **npm-скрипты и жизненный цикл** · **Разрешение модулей** · **Безопасность зависимостей** · **Workspaces и монорепы** · **Вопросы на собеседовании**
- **12.03 UI component libraries** — `/content/ecosystem-libs/ui-component-libraries`
  **Три подхода** · **Styled - «всё в комплекте»** · **Headless - логика без стилей** · Узкоспециализированные примитивы · **Copy-paste - ты владеешь кодом** · **Дизайн-системы** · **Стоимость, бандл и RSC** · **Когда UI-библиотека не нужна** · **Как выбрать** · **Vue-эквиваленты** · **Вопросы на собеседовании**
- **12.04 Styling solutions** — `/content/ecosystem-libs/styling-solutions`
  **Категории** · **Обычный CSS и Sass** · **CSS Modules** · **Utility-first: Tailwind** · **CSS-in-JS: runtime** · **CSS-in-JS: zero-runtime** · **Сдвиг из-за RSC** · **Как выбрать** · **Вопросы на собеседовании**
- **12.05 Forms and validation** — `/content/ecosystem-libs/forms-and-validation`
  **Зачем библиотека для форм** · **react-hook-form** · **Formik и другие** · Vue · **Схемная валидация** · Zod · Остальные · **Валидация на клиенте и на сервере** · **Как выбрать** · **Вопросы на собеседовании**
- **12.06 State and data libraries** — `/content/ecosystem-libs/state-and-data-libraries`
  **Главное различие: client vs server state** · **Менеджеры client-state** · Сторы · Атомарные · Proxy / реактивные · State machines · **Библиотеки server-state** · GraphQL-клиенты · **Нормализованный vs документный кэш** · **Как выбрать** · **Вопросы на собеседовании**
- **12.07 Meta-frameworks** — `/content/ecosystem-libs/meta-frameworks`
  **Зачем они нужны** · **Next.js** · **Remix / React Router 7** · **Astro** · **Другие** · **Сравнение** · **Как выбрать** · **Вопросы на собеседовании**
- **12.08 Utility libraries** — `/content/ecosystem-libs/utility-libraries`
  **Сначала - нативный JS** · **Общие утилиты** · **Даты** · **Иммутабельность** · **HTTP-клиенты** · **ID, классы и прочее** · **Как мыслить про утилиты** · **Вопросы на собеседовании**
- **12.09 Animation** — `/content/ecosystem-libs/animation`
  **CSS или библиотека?** · **Motion (ex-Framer Motion)** · **GSAP** · **react-spring и другие** · **Vue и нативное** · **Как выбрать** · **Вопросы на собеседовании**
- **12.10 Data visualization** — `/content/ecosystem-libs/data-visualization`
  **Спектр абстракции** · **D3.js** · **Готовые графики** · **visx** · **SVG vs Canvas** · **3D и WebGL** · **Как выбрать** · **Вопросы на собеседовании**
- **12.11 Tables and grids** — `/content/ecosystem-libs/tables-and-grids`
  **Почему таблицы сложные** · **Headless vs полный грид** · **TanStack Table** · **AG Grid** · **Виртуализация** · **Клиентская vs серверная обработка** · **Как выбрать** · **Вопросы на собеседовании**
- **12.12 i18n** — `/content/ecosystem-libs/i18n`
  **Что входит в i18n** · **Нативный Intl** · **Плюрализация - почему это сложно** · **ICU MessageFormat** · **Библиотеки** · **Организация переводов** · **RTL** · **Как выбрать** · **Вопросы на собеседовании**
- **12.13 Realtime and API clients** — `/content/ecosystem-libs/realtime-and-api-clients`
  **Три парадигмы API** · **REST-клиенты** · **GraphQL-клиенты** · **tRPC** · **Реалтайм-транспорты** · WebSocket и Socket.io · SSE · Hosted-решения · **Как выбрать** · **Вопросы на собеседовании**
- **12.14 Rich content** — `/content/ecosystem-libs/rich-content-and-interactions`
  **Редакторы форматированного текста** · **Markdown** · **Подсветка синтаксиса** · **Drag and drop** · **Загрузка файлов** · **Как выбрать** · **Вопросы на собеседовании**
- **12.15 Auth libraries** — `/content/ecosystem-libs/auth-libraries`
  **Два подхода: библиотека vs сервис** · **Библиотеки (self-hosted)** · **Сервисы и BaaS (managed)** · **Роль фронтенда** · **Как выбрать** · **Вопросы на собеседовании**
- **12.16 Build and patch** — `/content/ecosystem-libs/building-and-patching`
  **Это всё JavaScript** · **Патчинг чужих зависимостей** · patch-package / pnpm patch · Форк · Контрибьютить обратно · **Своя библиотека** · package.json библиотеки · Сборка · Публикация · **Framework-agnostic ядро + адаптеры** · **Главная мысль** · **Вопросы на собеседовании**

## 13. Testing and Deploying

- **13.01 Introduction** — `/content/testing-deploying/introduction`
  **Зачем тестировать** · **Уверенность vs стоимость** · **Зачем надёжный деплой** · **Цикл «от коммита до прода»** · **Shift left** · **Вопросы на собеседовании**
- **13.02 Testing strategy** — `/content/testing-deploying/testing-strategy-and-pyramid`
  **Виды тестов** · **Пирамида тестирования** · **Тестовый трофей** · **Что тестировать** · **Что НЕ тестировать** · **Структура теста** · **Smoke и regression тесты** · **Вопросы на собеседовании**
- **13.03 Test runners** — `/content/testing-deploying/test-runners`
  **Что делает раннер** · **Анатомия теста** · **Vitest vs Jest** · **DOM-окружение** · **Покрытие** · **Watch и фильтрация** · **Другие раннеры** · **Вопросы на собеседовании**
- **13.04 Unit and integration** — `/content/testing-deploying/unit-and-integration-testing`
  **Unit vs integration** · **Философия Testing Library** · **Хороший тест vs хрупкий** · **Принципы FIRST** · **Изоляция** · **Асинхронность** · **Детерминированность** · **Вопросы на собеседовании**
- **13.05 Mocking and test doubles** — `/content/testing-deploying/mocking-and-test-doubles`
  **Зачем подменять зависимости** · **Таксономия дублёров** · **Инструменты** · vi.fn() / jest.fn() - mock-функция · vi.spyOn() - шпион на существующем методе · vi.mock() - мок модуля · **MSW для сети** · **Фейковое время** · **Главный принцип: не перемокать** · **Вопросы на собеседовании**
- **13.06 E2E testing** — `/content/testing-deploying/e2e-testing`
  **Что такое e2e** · **Playwright vs Cypress** · **Селекторы** · **Flaky-тесты** · **Поддерживаемость e2e** · **Что покрывать e2e** · **Подготовка и скорость** · **Вопросы на собеседовании**
- **13.07 Visual and component** — `/content/testing-deploying/visual-and-component-testing`
  **Пробел функциональных тестов** · **Визуальная регрессия** · **Storybook** · **Компонентное тестирование** · **Snapshot-тестирование** · **Доступность** · **Что когда использовать** · **Вопросы на собеседовании**
- **13.08 Coverage and TDD** — `/content/testing-deploying/coverage-and-tdd`
  **Метрики покрытия** · **Пределы покрытия** · **Мутационное тестирование** · **TDD** · **BDD** · **Что отвечать про «сколько покрытия»** · **Вопросы на собеседовании**
- **13.09 Environments and config** — `/content/testing-deploying/environments-and-config`
  **Окружения** · **Что различается между окружениями** · **Переменные окружения** · **Build-time vs runtime config** · **Секреты** · **Вопросы на собеседовании**
- **13.10 Hosting and platforms** — `/content/testing-deploying/hosting-and-platforms`
  **Фундаментальное различие** · **Статический хостинг** · **Серверный хостинг** · **Serverless и edge** · **JAMstack и BaaS** · **Мета-фреймворки и платформы** · **Как выбрать** · **Вопросы на собеседовании**
- **13.11 Deployment strategies** — `/content/testing-deploying/deployment-strategies`
  **Проблема** · **Основные стратегии** · Rolling · Blue-green · Canary · **Feature flags** · **Обратная совместимость** · **Откат** · **Превью-деплои** · **Progressive delivery** · **Вопросы на собеседовании**
- **13.12 CDN and caching** — `/content/testing-deploying/cdn-and-caching`
  **CDN** · **Стратегия кеширования ассетов** · **Заголовки Cache-Control** · **Cache busting** · **Инвалидация CDN** · **Edge и динамика** · **Ассеты и изображения** · **Вопросы на собеседовании**
- **13.13 Containers and Docker** — `/content/testing-deploying/containers-and-docker`
  **Что такое контейнер** · **Основы Docker** · **Фронтенд в контейнере** · **nginx для SPA** · **Слои и кеш** · **Когда контейнеры нужны** · **Оркестрация** · **Вопросы на собеседовании**
- **13.14 Monitoring** — `/content/testing-deploying/monitoring-and-observability`
  **Зачем мониторинг** · **Трекинг ошибок** · **RUM - реальная производительность** · **Продуктовая аналитика** · **Логи, метрики, трейсы** · **Алерты и uptime** · **Замыкая круг** · **Вопросы на собеседовании**

## 14. Additional Topics

- **14.01 Web Workers** — `/content/additional-topics/web-workers-and-concurrency`
  **Проблема главного потока** · **Web Worker** · **Виды воркеров** · **Передача данных** · Transferable objects · SharedArrayBuffer · **OffscreenCanvas** · **Comlink** · **Когда использовать** · **Concurrency в React - это другое** · **Вопросы на собеседовании**
- **14.02 WebAssembly** — `/content/additional-topics/webassembly`
  **Что это и зачем** · **Не замена JavaScript** · **Как работает** · **Сценарии использования** · **Инструменты** · **WASM за пределами браузера** · **Ограничения** · **Вопросы на собеседовании**
- **14.03 Graphics** — `/content/additional-topics/graphics-canvas-webgl`
  **Спектр графики** · **SVG** · **Canvas 2D** · **SVG vs Canvas** · **WebGL** · **WebGPU** · **OffscreenCanvas** · **Как выбрать** · **Вопросы на собеседовании**
- **14.04 Media and WebRTC** — `/content/additional-topics/media-and-webrtc`
  **Захват медиа** · **Web Audio API** · **WebRTC** · Как устанавливается соединение · **Стриминг** · **На практике - сервисы** · **Сценарии** · **Вопросы на собеседовании**
- **14.05 Cross-platform** — `/content/additional-topics/cross-platform`
  **Спектр подходов** · **Мобайл** · React Native · Capacitor / Ionic · Flutter · **Десктоп** · Electron · Tauri · **PWA как приложение** · **Переиспользование кода** · **Как выбрать** · **Вопросы на собеседовании**
- **14.06 AI in the frontend** — `/content/additional-topics/ai-in-the-frontend`
  **Роль фронтенда** · **Главное правило: ключи на сервере** · **Стриминг** · **Vercel AI SDK** · **Tool calling и структурированный вывод** · **Embeddings и RAG** · **UI-паттерны и риски** · **Модели в браузере** · **Вопросы на собеседовании**
- **14.07 Beyond frontend** — `/content/additional-topics/beyond-frontend`
  **Карта доменов** · **Backend - ближайший шаг** · **Browser extensions - почти фронтенд** · **Native mobile** · **Game development** · **Web3 / блокчейн** · **AI / ML инженерия** · **DevOps / SRE / Platform** · **Embedded / IoT и системное** · **Как переходить** · **Вопросы на собеседовании**

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

- **18.01 Resume** — `/content/preparing-for-interviews/resume`
  **Что хочет увидеть рекрутер** · **Структура** · **Импакт-буллеты** · **Таргетинг под вакансию** · **ATS** · **Длина** · **Навыки** · **Портфолио и онлайн-присутствие** · **Резюме senior-уровня** · **Чеклист** · **Частые ошибки**
- **18.02 Platforms** — `/content/preparing-for-interviews/platforms`
  **Каналы поиска** · **Типы компаний** · **Рефералы решают** · **Нетворкинг и присутствие** · **Inbound - пусть находят тебя** · **Качество, а не количество** · **Поиск на senior-уровне** · **Чеклист** · **Частые ошибки**
- **18.03 Apply tricks** — `/content/preparing-for-interviews/apply-tricks`
  **Воронка и числа** · **Сначала - реферал** · **Таргетинг под вакансию** · **Сопроводительное письмо** · **Тайминг и прямой контакт** · **Веди учёт** · **Объём vs качество** · **Отказы и тишина** · **Красные флаги в вакансии** · **Отклик на senior-уровне** · **Чеклист** · **Частые ошибки**
- **18.04 HR screening** — `/content/preparing-for-interviews/hr-screening`
  **Что проверяет рекрутер** · **Типичные вопросы** · **«Расскажите о себе»** · **Вопрос про зарплату** · **«Почему уходите» и «почему мы»** · **Твои вопросы** · **Калибровка уровня** · **Чеклист** · **Частые ошибки**
- **18.05 Technical interview** — `/content/preparing-for-interviews/technical-interview`
  **Форматы** · **Алгоритмы vs фронтенд-задачи** · **System design (mid+/senior)** · **Take-home** · **Как готовиться** · **Как вести себя на интервью** · **Если застрял** · **Что реально оценивают** · **Чего ждут от senior на техничке** · **Чеклист** · **Частые ошибки**
- **18.06 Behavioral interview** — `/content/preparing-for-interviews/behavioral-interview`
  **Что оценивают** · **Метод STAR** · **Типичные вопросы** · **Подготовь истории заранее** · **Сигналы seniority** · **Вопрос про провал** · **Вопрос про конфликт** · **Честность и тон** · **Поведенческое на senior+** · **Чеклист** · **Частые ошибки**
- **18.07 Final interview** — `/content/preparing-for-interviews/final-interview`
  **Что это за этап** · **Раунд с нанимающим менеджером** · **Вопросы к компании - теперь критичны** · **Это двусторонний выбор** · **Продай себя - ещё раз** · **Финал на senior-уровне** · **Чеклист** · **Частые ошибки**
- **18.08 Follow ups** — `/content/preparing-for-interviews/follow-ups`
  **Follow-up после интервью** · **Оценка оффера** · **Переговоры о зарплате** · Что можно обсуждать, кроме оклада · Конкурирующие офферы · **Несколько офферов** · **Отказ от компании** · **Если отказали тебе** · **Принятие оффера** · **Переговоры на senior-уровне** · **Чеклист** · **Частые ошибки**

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

- **20.01 Continuous learning** — `/content/final-steps/continuous-learning`
  **Принципы, а не синтаксис** · **Глубина и ширина** · **Как учиться эффективно** · **Оставаться в курсе без выгорания** · **Эффект сложного процента** · **Стоит ли это учить** · **Чеклист**
- **20.02 Career growth** — `/content/final-steps/career-growth`
  **Лестница грейдов** · **Две траектории: IC и менеджмент** · **Как расти на уровень** · **Видимость** · **Профессиональное присутствие** · **Знай свою цену** · **Чеклист**
- **20.03 Engineering maturity** — `/content/final-steps/engineering-maturity`
  **Код - это базовый уровень** · **Коммуникация** · **Техническое письмо** · **Код-ревью** · **Суждение и решения** · **Ответственность и надёжность** · **Работа с неопределённостью** · **Поднимать других** · **Скромность и рост** · **Отдавать сообществу** · **Устойчивость** · **Чеклист**
- **20.04 Final words** — `/content/final-steps/final-words`
  **Путь, который ты прошёл** · **Что важнее всего** · **Кто такой Frontend Legend** · **Это не конец** · **Куда дальше** · **Напоследок**
