/* WalimApp demo — vanilla SPA (trilingual fr/ar/en). Premium marketplace UI. */
'use strict';

const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const fmtDzd = (n, lang) => {
  const v = Number(n).toLocaleString(lang === 'ar' ? 'ar-DZ-u-nu-latn' : lang === 'fr' ? 'fr-DZ' : 'en-US');
  return lang === 'ar' ? `${v} دج` : lang === 'en' ? `${v} DZD` : `${v} DA`;
};

/* ---------------- i18n ---------------- */
const I18N = {
  navSearch: { fr: 'Recherche', ar: 'بحث', en: 'Search' },
  navStudio: { fr: 'Studio déco', ar: 'استوديو الديكور', en: 'Décor studio' },
  hero: { fr: 'Trouvez la salle de vos rêves', ar: 'اعثروا على قاعة أحلامكم', en: 'Find the hall of your dreams' },
  heroSub: {
    fr: 'Explorez les salles de 69 wilayas, laissez le concierge Muse Spark les classer pour vous, prévisualisez en panorama 360° et envoyez votre demande de réservation.',
    ar: 'اكتشفوا قاعات 69 ولاية، ودعوا مساعد Muse Spark يرتبها لكم، وعاينوا القاعات بصور بانورامية 360° ثم أرسلوا طلب الحجز.',
    en: 'Browse halls across 69 wilayas, let the Muse Spark concierge rank them for you, preview in 360° panoramas and send your booking inquiry.',
  },
  demoCatalog: {
    fr: 'Catalogue de démonstration · 69 Wilayas',
    ar: 'كتالوج تجريبي · 69 ولاية',
    en: 'Demonstration Marketplace · 69 Wilayas',
  },
  conciergeTitle: { fr: 'Concierge Muse Spark', ar: 'مساعد Muse Spark الذكي', en: 'Muse Spark Concierge' },
  conciergeHint: {
    fr: 'Décrivez votre mariage idéal — le concierge comprend votre demande et classe les salles pour vous.',
    ar: 'صفوا زفافكم المثالي — يفهم المساعد طلبكم ويرتب القاعات من أجلكم.',
    en: 'Describe your dream wedding — the concierge understands and ranks venues for you.',
  },
  quickLabel: { fr: 'Idées :', ar: 'أفكار:', en: 'Ideas:' },
  qp1Label: {
    fr: 'Alger · 250 invités · parking & traiteur',
    ar: 'الجزائر · 250 ضيف · موقف ومطعم',
    en: 'Algiers · 250 guests · parking & catering',
  },
  qp1: {
    fr: 'Je cherche une salle élégante à Alger pour 250 invités, avec parking et traiteur, budget 450 000 DA',
    ar: 'أبحث عن قاعة أنيقة في الجزائر لـ250 ضيفاً، مع موقف سيارات ومطعم، بميزانية 450000 دج',
    en: 'I need an elegant hall in Algiers for 250 guests, with parking and catering, budget 450,000 DZD',
  },
  qp2Label: {
    fr: 'Oran · réception avec vue sur mer',
    ar: 'وهران · حفل بإطلالة على البحر',
    en: 'Oran · sea-view reception',
  },
  qp2: {
    fr: 'Je veux une grande salle avec vue sur mer à Oran pour 400 invités, avec hébergement',
    ar: 'أريد قاعة كبيرة بإطلالة على البحر في وهران لـ400 ضيف، مع إقامة',
    en: 'I want a grand sea-view reception hall in Oran for 400 guests, with lodging',
  },
  qp3Label: {
    fr: 'Constantine · palais traditionnel',
    ar: 'قسنطينة · قصر تقليدي',
    en: 'Constantine · traditional palace',
  },
  qp3: {
    fr: 'Je cherche un palais traditionnel à Constantine pour 300 invités, style oriental',
    ar: 'أبحث عن قصر تقليدي في قسنطينة لـ300 ضيف، بالطراز الشرقي',
    en: 'I am looking for a traditional palace in Constantine for 300 guests, oriental style',
  },
  demoVenue: { fr: 'Salle démo', ar: 'قاعة تجريبية', en: 'Demo venue' },
  demoRecord: {
    fr: 'Démonstration · fiche fictive',
    ar: 'عرض تجريبي · بطاقة وهمية',
    en: 'Demonstration · sample record',
  },
  pendingPolicy: {
    fr: 'Sans engagement : votre date reste disponible tant que la salle ne confirme pas votre demande.',
    ar: 'بدون التزام: يبقى تاريخكم متاحاً حتى تؤكد القاعة طلبكم.',
    en: 'No commitment: your date stays available until the hall confirms your inquiry.',
  },
  venuePick: { fr: 'Votre sélection', ar: 'اختياركم', en: 'Your selection' },
  photoView: { fr: 'Voir la photo', ar: 'عرض الصورة', en: 'View photo' },
  wilaya: { fr: 'Wilaya', ar: 'الولاية', en: 'Wilaya' },
  allWilayas: { fr: 'Toutes les wilayas', ar: 'كل الولايات', en: 'All wilayas' },
  commune: { fr: 'Commune', ar: 'البلدية', en: 'Commune' },
  communePh: { fr: 'ex. Hydra', ar: 'مثال: حيدرة', en: 'e.g. Hydra' },
  date: { fr: 'Date du mariage', ar: 'تاريخ الزفاف', en: 'Wedding date' },
  guests: { fr: 'Invités', ar: 'الضيوف', en: 'Guests' },
  budget: { fr: 'Budget (DA)', ar: 'الميزانية (دج)', en: 'Budget (DZD)' },
  style: { fr: 'Style', ar: 'الطراز', en: 'Style' },
  anyStyle: { fr: 'Tous styles', ar: 'كل الأنماط', en: 'Any style' },
  searchBtn: { fr: 'Rechercher', ar: 'ابحث', en: 'Search' },
  aiRankBtn: { fr: 'Classer avec Muse Spark', ar: 'رتّب بواسطة Muse Spark', en: 'Rank with Muse Spark' },
  sparkPromptLabel: { fr: 'Décrivez vos besoins en langage naturel', ar: 'صفوا احتياجاتكم بلغة طبيعية', en: 'Describe your needs in natural language' },
  sparkPromptPh: {
    fr: 'ex. Je cherche une salle élégante à Alger pour 250 invités en juin, avec parking et traiteur, budget 450 000 DA…',
    ar: 'مثال: أبحث عن قاعة أنيقة في الجزائر لـ250 ضيف في جوان، مع موقف ومطعم، بميزانية 450000 دج…',
    en: 'e.g. I need an elegant hall in Algiers for 250 guests in June, with parking and catering, budget 450,000 DZD…',
  },
  extractedLabel: { fr: 'Critères extraits', ar: 'المعايير المستخرجة', en: 'Extracted criteria' },
  clearAiCriteria: { fr: 'Effacer les critères IA', ar: 'مسح معايير الذكاء الاصطناعي', en: 'Clear AI criteria' },
  results: { fr: 'Résultats', ar: 'النتائج', en: 'Results' },
  hallsFound: { fr: 'salles trouvées', ar: 'قاعة', en: 'halls found' },
  noResults: { fr: 'Aucune salle ne correspond. Essayez d’élargir les critères.', ar: 'لا توجد قاعة مطابقة. جرّبوا توسيع المعايير.', en: 'No hall matches. Try broadening the criteria.' },
  details: { fr: 'Détails', ar: 'التفاصيل', en: 'Details' },
  capacity: { fr: 'Capacité', ar: 'السعة', en: 'Capacity' },
  price: { fr: 'Tarif', ar: 'السعر', en: 'Price' },
  overBudget: { fr: 'Au-dessus du budget de {amount}', ar: 'أعلى من الميزانية بـ {amount}', en: 'Over budget by {amount}' },
  rating: { fr: 'Avis', ar: 'التقييم', en: 'Rating' },
  reviews: { fr: 'avis', ar: 'تقييم', en: 'reviews' },
  amenities: { fr: 'Équipements', ar: 'المرافق', en: 'Amenities' },
  styles: { fr: 'Styles', ar: 'الأنماط', en: 'Styles' },
  book: { fr: 'Envoyer une demande', ar: 'أرسلوا طلباً', en: 'Send an inquiry' },
  decorate: { fr: 'Visualiser la déco', ar: 'تصوروا الديكور', en: 'Preview décor' },
  tour: { fr: 'Visite 360°', ar: 'جولة 360°', en: '360° tour' },
  tourLoad: { fr: 'Charger la visite d’exemple', ar: 'تحميل الجولة النموذجية', en: 'Load the sample tour' },
  tourSample: {
    fr: 'Aperçu photo panoramique 360° interactif (panorama de démonstration — il ne s’agit pas d’un scan 3D). Les panoramas réels des salles seront bientôt disponibles.',
    ar: 'معاينة تفاعلية بصورة بانورامية 360° (بانوراما تجريبية — ليست مسحاً ثلاثي الأبعاد). الصور البانورامية الحقيقية للقاعات قريباً.',
    en: 'Interactive 360° panoramic photo preview (sample demonstration panorama — not a 3D scan). Genuine hall panoramas coming soon.',
  },
  studioTitle: { fr: 'Studio décoration IA', ar: 'استوديو الديكور بالذكاء الاصطناعي', en: 'AI décor studio' },
  studioSub: {
    fr: 'Importez une photo de la salle : SAM 3.1 détecte la scène, les tables, les chaises et les décorations, puis Muse Image propose des concepts personnalisés.',
    ar: 'ارفعوا صورة القاعة: يكتشف SAM 3.1 المسرح والطاولات والكراسي والزينة، ثم يقترح Muse Image أفكاراً مخصصة.',
    en: 'Upload a hall photo: SAM 3.1 finds the stage, tables, chairs and decorations, then Muse Image suggests personalised concepts.',
  },
  upload: { fr: 'Choisir une photo', ar: 'اختاروا صورة', en: 'Choose a photo' },
  segment: { fr: 'Analyser avec SAM 3.1', ar: 'حلّلوا بواسطة SAM 3.1', en: 'Analyse with SAM 3.1' },
  segmented: { fr: 'Zones détectées', ar: 'المناطق المكتشفة', en: 'Detected zones' },
  needPhoto: { fr: 'Importez d’abord une photo de salle.', ar: 'ارفعوا أولاً صورة للقاعة.', en: 'Upload a hall photo first.' },
  palette: { fr: 'Palette', ar: 'الألوان', en: 'Palette' },
  notes: { fr: 'Vos envies (optionnel)', ar: 'رغباتكم (اختياري)', en: 'Your wishes (optional)' },
  notesPh: { fr: 'ex. ambiance dorée, fleurs blanches…', ar: 'مثال: أجواء ذهبية، ورود بيضاء…', en: 'e.g. golden mood, white flowers…' },
  generate: { fr: 'Générer avec Muse Image', ar: 'ولّدوا بواسطة Muse Image', en: 'Generate with Muse Image' },
  concepts: { fr: 'Concepts proposés', ar: 'الأفكار المقترحة', en: 'Suggested concepts' },
  tips: { fr: 'Conseils', ar: 'نصائح', en: 'Tips' },
  inquiryTitle: { fr: 'Demande de réservation', ar: 'طلب حجز', en: 'Booking inquiry' },
  inquirySub: {
    fr: 'Votre demande commence comme pending (en attente) et ne bloque pas les disponibilités tant que la salle ne l’a pas acceptée/confirmée (confirmée par la salle).',
    ar: 'يبدأ طلبكم قيد الانتظار ولا يحجز التواريخ حتى تقبله/تؤكده القاعة.',
    en: 'Your request starts as pending and does not block availability until the hall owner accepts/confirms it.',
  },
  name: { fr: 'Nom complet', ar: 'الاسم الكامل', en: 'Full name' },
  phone: { fr: 'Téléphone', ar: 'الهاتف', en: 'Phone' },
  message: { fr: 'Message (optionnel)', ar: 'رسالة (اختياري)', en: 'Message (optional)' },
  consent: {
    fr: 'J’accepte que mes coordonnées soient transmises à la salle pour traiter ma demande (loi 18-07).',
    ar: 'أوافق على إرسال بياناتي إلى القاعة لمعالجة طلبي (القانون 18-07).',
    en: 'I agree that my contact details are shared with the hall to handle my inquiry (Law 18-07).',
  },
  send: { fr: 'Envoyer la demande', ar: 'إرسال الطلب', en: 'Send inquiry' },
  consentReq: { fr: 'Le consentement est obligatoire pour envoyer la demande.', ar: 'الموافقة ضرورية لإرسال الطلب.', en: 'Consent is required to send the inquiry.' },
  confirmTitle: { fr: 'Demande envoyée', ar: 'تم إرسال الطلب', en: 'Inquiry sent' },
  yourRef: { fr: 'Votre référence', ar: 'مرجعكم', en: 'Your reference' },
  pending: { fr: 'En attente de validation', ar: 'قيد الانتظار', en: 'Pending confirmation' },
  confirmNote: {
    fr: 'Votre demande est pending (en attente) : elle ne bloque pas les disponibilités tant que la salle ne l’a pas acceptée/confirmée (confirmée par la salle). La salle vous contactera.',
    ar: 'طلبكم قيد الانتظار: لا يحجز التواريخ حتى تقبله/تؤكده القاعة. ستتصل بكم القاعة.',
    en: 'Your request is pending: it does not block availability until the hall owner accepts/confirms it. The hall will contact you.',
  },
  backSearch: { fr: 'Retour à la recherche', ar: 'عودة إلى البحث', en: 'Back to search' },
  navOwner: { fr: 'Propriétaire', ar: 'المالك', en: 'Owner' },
  navTrack: { fr: 'Suivi', ar: 'تتبع الطلب', en: 'Tracking' },
  ownerTitle: { fr: 'Espace propriétaire', ar: 'فضاء المالك', en: 'Owner dashboard' },
  ownerDemo: {
    fr: 'Interface propriétaire de démonstration — sans authentification réelle. Les décisions sont enregistrées dans le fichier inquiries.json.',
    ar: 'واجهة تجريبية للمالك — بدون مصادقة حقيقية. تُحفظ القرارات في ملف inquiries.json.',
    en: 'Demo owner interface — no real authentication. Decisions are stored in the inquiries.json file.',
  },
  statTotal: { fr: 'Demandes', ar: 'الطلبات', en: 'Inquiries' },
  statPending: { fr: 'En attente', ar: 'قيد الانتظار', en: 'Pending' },
  statConfirmed: { fr: 'Confirmées', ar: 'مؤكدة', en: 'Confirmed' },
  statRejected: { fr: 'Refusées', ar: 'مرفوضة', en: 'Rejected' },
  filterStatus: { fr: 'Statut', ar: 'الحالة', en: 'Status' },
  filterHall: { fr: 'Salle', ar: 'القاعة', en: 'Hall' },
  filterDate: { fr: 'Date', ar: 'التاريخ', en: 'Date' },
  allStatuses: { fr: 'Tous statuts', ar: 'كل الحالات', en: 'All statuses' },
  allHalls: { fr: 'Toutes les salles', ar: 'كل القاعات', en: 'All halls' },
  noInquiries: { fr: 'Aucune demande pour ces critères.', ar: 'لا طلبات لهذه المعايير.', en: 'No inquiries match these filters.' },
  client: { fr: 'Client', ar: 'الزبون', en: 'Client' },
  event: { fr: 'Événement', ar: 'المناسبة', en: 'Event' },
  requestedOn: { fr: 'Demandé le', ar: 'تاريخ الطلب', en: 'Requested on' },
  ownerNote: { fr: 'Note au client (optionnel)', ar: 'ملاحظة للزبون (اختياري)', en: 'Note to client (optional)' },
  accept: { fr: 'Accepter', ar: 'قبول', en: 'Accept' },
  reject: { fr: 'Refuser', ar: 'رفض', en: 'Reject' },
  confirmAccept: { fr: 'Confirmer cette réservation ?', ar: 'تأكيد هذا الحجز؟', en: 'Confirm this booking?' },
  confirmReject: { fr: 'Refuser cette demande ?', ar: 'رفض هذا الطلب؟', en: 'Reject this inquiry?' },
  decidedOn: { fr: 'Décision le', ar: 'تاريخ القرار', en: 'Decided on' },
  overview: { fr: 'Aperçu par date', ar: 'نظرة حسب التاريخ', en: 'Overview by date' },
  trackTitle: { fr: 'Suivre ma demande', ar: 'تتبع طلبي', en: 'Track my inquiry' },
  trackSub: {
    fr: 'Saisissez la référence reçue après l’envoi (ex. WAL-ABC123).',
    ar: 'أدخلوا المرجع المستلم بعد الإرسال (مثال: WAL-ABC123).',
    en: 'Enter the reference received after sending (e.g. WAL-ABC123).',
  },
  trackBtn: { fr: 'Voir le statut', ar: 'عرض الحالة', en: 'Check status' },
  notFound: { fr: 'Référence introuvable. Vérifiez le code saisi.', ar: 'المرجع غير موجود. تحققوا من الرمز.', en: 'Reference not found. Check the code.' },
  ownerResponse: { fr: 'Réponse de la salle', ar: 'رد القاعة', en: 'Hall response' },
  noResponse: { fr: 'En attente de réponse.', ar: 'في انتظار الرد.', en: 'Awaiting response.' },
  live: { fr: 'IA EN DIRECT', ar: 'ذكاء اصطناعي مباشر', en: 'LIVE AI' },
  demo: { fr: 'DÉMO', ar: 'تجريبي', en: 'DEMO' },
  foot: {
    fr: 'Démonstration : données fictives, aucun client réel. Clés API Meta conservées côté serveur.',
    ar: 'عرض تجريبي: بيانات وهمية، لا زبائن حقيقيين. مفاتيح Meta محفوظة في الخادم.',
    en: 'Demonstration: fictional data, no real customers. Meta API keys kept server-side.',
  },
  loading: { fr: 'Chargement…', ar: 'جارٍ التحميل…', en: 'Loading…' },
  aiWorking: { fr: 'L’IA réfléchit…', ar: 'الذكاء الاصطناعي يفكر…', en: 'AI is thinking…' },
  error: { fr: 'Une erreur est survenue. Réessayez.', ar: 'حدث خطأ. حاولوا مجدداً.', en: 'Something went wrong. Please retry.' },
  conflictErr: {
    fr: 'Cette date est déjà réservée pour cette salle (confirmée par la salle).',
    ar: 'هذا التاريخ محجوز مسبقاً لهذه القاعة (أكدته القاعة).',
    en: 'This date is already booked for this hall (confirmed by the hall).',
  },
  /* --- Task 02: auth, account, owner workspace, brand --- */
  brandTagline: {
    fr: "WalimApp · Salles d'exception en Algérie",
    ar: 'وليم آب · الدليل الأول لقاعات الحفلات في الجزائر',
    en: 'WalimApp · Premium Algerian Wedding Venues',
  },
  navSignIn: { fr: 'Se connecter', ar: 'تسجيل الدخول', en: 'Sign in' },
  navSignUp: { fr: 'Créer un compte', ar: 'إنشاء حساب', en: 'Create account' },
  navSignOut: { fr: 'Se déconnecter', ar: 'تسجيل الخروج', en: 'Sign out' },
  navMyAccount: { fr: 'Mes réservations', ar: 'حجوزاتي', en: 'My Bookings' },
  navOwnerWorkspace: { fr: 'Espace propriétaire', ar: 'فضاء المالك', en: 'Owner workspace' },
  registerTitle: { fr: 'Créer votre compte', ar: 'أنشئوا حسابكم', en: 'Create your account' },
  registerSub: {
    fr: 'Suivez vos demandes, recevez les réponses des salles et réservez plus vite.',
    ar: 'تابعوا طلباتكم، واستلموا ردود القاعات واحجزوا بسرعة.',
    en: 'Track your inquiries, receive hall responses and book faster.',
  },
  fullName: { fr: 'Nom complet', ar: 'الاسم الكامل', en: 'Full name' },
  email: { fr: 'E-mail', ar: 'البريد الإلكتروني', en: 'Email' },
  password: { fr: 'Mot de passe', ar: 'كلمة المرور', en: 'Password' },
  confirmPassword: { fr: 'Confirmer le mot de passe', ar: 'تأكيد كلمة المرور', en: 'Confirm password' },
  createAccountBtn: { fr: 'Créer mon compte', ar: 'إنشاء الحساب', en: 'Create account' },
  alreadyHaveAccount: { fr: 'Déjà un compte ?', ar: 'لديكم حساب؟', en: 'Already have an account?' },
  passwordHelp: {
    fr: '8 caractères minimum, avec au moins 1 lettre et 1 chiffre.',
    ar: '8 أحرف على الأقل، مع حرف واحد ورقم واحد.',
    en: 'Minimum 8 characters, with at least 1 letter and 1 number.',
  },
  errPasswordMismatch: { fr: 'Les mots de passe ne correspondent pas.', ar: 'كلمتا المرور غير متطابقتين.', en: 'Passwords do not match.' },
  errWeakPassword: {
    fr: 'Mot de passe trop faible : 8 caractères minimum, 1 lettre et 1 chiffre.',
    ar: 'كلمة المرور ضعيفة: 8 أحرف على الأقل مع حرف ورقم.',
    en: 'Weak password: minimum 8 characters, 1 letter and 1 number.',
  },
  errEmailTaken: { fr: 'Cet e-mail est déjà utilisé.', ar: 'هذا البريد مستخدم مسبقاً.', en: 'This email is already registered.' },
  errInvalidName: { fr: 'Veuillez saisir votre nom complet.', ar: 'يرجى إدخال الاسم الكامل.', en: 'Please enter your full name.' },
  errInvalidEmail: { fr: 'Adresse e-mail invalide.', ar: 'بريد إلكتروني غير صالح.', en: 'Invalid email address.' },
  loginTitle: { fr: 'Connexion', ar: 'تسجيل الدخول', en: 'Sign in' },
  loginSub: {
    fr: 'Retrouvez vos demandes de réservation et les réponses des salles.',
    ar: 'اعثروا على طلبات حجزكم وردود القاعات.',
    en: 'Find your booking inquiries and hall responses.',
  },
  loginBtn: { fr: 'Se connecter', ar: 'تسجيل الدخول', en: 'Sign in' },
  noAccountYet: { fr: 'Pas encore de compte ?', ar: 'ليس لديكم حساب؟', en: "Don't have an account yet?" },
  errInvalidCredentials: { fr: 'E-mail ou mot de passe incorrect.', ar: 'البريد أو كلمة المرور غير صحيحة.', en: 'Incorrect email or password.' },
  ownerLoginTitle: { fr: 'Connexion propriétaire', ar: 'دخول المالك', en: 'Owner sign in' },
  ownerLoginHint: {
    fr: 'Réservé aux propriétaires de salles. Gérez les demandes, le calendrier et les confirmations.',
    ar: 'مخصص لمالكي القاعات. أديروا الطلبات والتقويم والتأكيدات.',
    en: 'For hall owners only. Manage inquiries, calendar and confirmations.',
  },
  ownerNotConfiguredHint: {
    fr: "L'accès propriétaire n'est pas configuré. Définissez OWNER_EMAIL et OWNER_PASSWORD dans le fichier .env puis redémarrez le serveur.",
    ar: 'دخول المالك غير مُعد. حددوا OWNER_EMAIL وOWNER_PASSWORD في ملف .env ثم أعيدوا تشغيل الخادم.',
    en: 'Owner access is not configured. Set OWNER_EMAIL and OWNER_PASSWORD in the .env file then restart the server.',
  },
  ownerSetupTitle: { fr: 'Espace propriétaire — configuration requise', ar: 'فضاء المالك — يلزم الإعداد', en: 'Owner workspace — setup required' },
  ownerAccessDenied: {
    fr: 'Accès réservé aux propriétaires de salles.',
    ar: 'الدخول مخصص لمالكي القاعات فقط.',
    en: 'Access restricted to wedding hall owners.',
  },
  custWelcome: { fr: 'Bon retour', ar: 'مرحباً بعودتكم', en: 'Welcome back' },
  custDashSub: {
    fr: 'Vos demandes de réservation et les réponses des salles, au même endroit.',
    ar: 'طلبات حجزكم وردود القاعات في مكان واحد.',
    en: 'Your booking inquiries and hall responses, in one place.',
  },
  custInquiriesTitle: { fr: 'Mes demandes', ar: 'طلباتي', en: 'My inquiries' },
  custNoInquiries: {
    fr: 'Vous n’avez pas encore de demande. Explorez les salles et envoyez votre première demande.',
    ar: 'ليس لديكم أي طلب بعد. اكتشفوا القاعات وأرسلوا طلبكم الأول.',
    en: 'You have no inquiries yet. Browse the halls and send your first inquiry.',
  },
  browseHalls: { fr: 'Parcourir les salles', ar: 'تصفحوا القاعات', en: 'Browse Wedding Halls' },
  colRef: { fr: 'Référence', ar: 'المرجع', en: 'Reference' },
  colHall: { fr: 'Salle', ar: 'القاعة', en: 'Hall' },
  colDate: { fr: 'Date', ar: 'التاريخ', en: 'Date' },
  colGuests: { fr: 'Invités', ar: 'الضيوف', en: 'Guests' },
  colStatus: { fr: 'Statut', ar: 'الحالة', en: 'Status' },
  colSubmitted: { fr: 'Envoyée le', ar: 'تاريخ الإرسال', en: 'Submitted' },
  viewDetails: { fr: 'Voir les détails', ar: 'عرض التفاصيل', en: 'View Details' },
  ownerNoteLabel: { fr: 'Réponse de la salle', ar: 'رد القاعة', en: 'Owner response' },
  noNoteYet: { fr: 'Pas encore de réponse de la salle.', ar: 'لا رد من القاعة بعد.', en: 'No owner response yet.' },
  yourMessage: { fr: 'Votre message', ar: 'رسالتكم', en: 'Your message' },
  close: { fr: 'Fermer', ar: 'إغلاق', en: 'Close' },
  ownerPortalTitle: { fr: 'Espace opérationnel propriétaire', ar: 'فضاء عمل المالك', en: 'Owner operational workspace' },
  ownerBadge: { fr: 'Propriétaire', ar: 'مالك', en: 'Owner' },
  tabInquiries: { fr: 'Tri des demandes', ar: 'فرز الطلبات', en: 'Inquiries Triage' },
  tabCalendar: { fr: 'Calendrier / À venir', ar: 'التقويم / القادم', en: 'Calendar / Upcoming' },
  searchInquiriesPh: { fr: 'Rechercher par référence, nom ou téléphone…', ar: 'ابحثوا بالمرجع أو الاسم أو الهاتف…', en: 'Search by reference, name or phone…' },
  conflictWarning: { fr: 'Demandes en concurrence', ar: 'طلبات متنافسة', en: 'Competing Inquiries' },
  conflictExists: { fr: 'Date déjà réservée — conflit', ar: 'التاريخ محجوز — تعارض', en: 'Date Already Booked — Conflict' },
  upcomingEventsTitle: { fr: 'Événements confirmés à venir', ar: 'الأحداث المؤكدة القادمة', en: 'Upcoming confirmed events' },
  noUpcomingEvents: { fr: 'Aucun événement confirmé pour le moment.', ar: 'لا أحداث مؤكدة حالياً.', en: 'No upcoming confirmed events yet.' },
  pendingSoonTitle: { fr: 'Demandes en attente proches', ar: 'طلبات قيد الانتظار قريبة', en: 'Approaching pending requests' },
  noPendingSoon: { fr: 'Aucune demande en attente proche.', ar: 'لا طلبات قريبة قيد الانتظار.', en: 'No approaching pending requests.' },
  nextEvent: { fr: 'Prochain événement', ar: 'الحدث القادم', en: 'Next Upcoming Event' },
  noNextEvent: { fr: '—', ar: '—', en: '—' },
  quickTriage: { fr: 'À traiter en priorité', ar: 'للمعالجة أولاً', en: 'Needs quick triage' },
  addOwnerNotePh: { fr: 'Note au client : acompte, règlement, motif…', ar: 'ملاحظة للزبون: عربون، نظام، سبب…', en: 'Note to client: deposit, policy, reason…' },
  search: { fr: 'Rechercher', ar: 'بحث', en: 'Search' },
  bookingAs: { fr: 'Réservation en tant que', ar: 'الحجز باسم', en: 'Booking as' },
  bookingAsNote: { fr: 'Cette demande apparaîtra dans votre tableau de bord personnel.', ar: 'سيظهر هذا الطلب في لوحة حسابكم.', en: 'This inquiry will appear in your personal dashboard.' },
  viewInAccount: { fr: 'Voir dans Mon compte', ar: 'عرض في حسابي', en: 'View in My Account' },
  guestNote: {
    fr: 'Vous réservez en invité. Créez un compte pour suivre vos demandes plus facilement.',
    ar: 'تحجزون كضيف. أنشئوا حساباً لتتبع طلباتكم بسهولة.',
    en: 'You are booking as a guest. Create an account to track your inquiries easily.',
  },
  decisionDone: { fr: 'Décision enregistrée.', ar: 'تم تسجيل القرار.', en: 'Decision recorded.' },
  /* --- Task 04: owner halls + tours --- */
  tabHalls: { fr: 'Mes Salles', ar: 'قاعاتي', en: 'Halls' },
  myHallsTitle: { fr: 'Mes salles', ar: 'قاعاتي', en: 'My venues' },
  addHall: { fr: 'Ajouter une salle', ar: 'إضافة قاعة', en: 'Add Venue' },
  editHall: { fr: 'Modifier', ar: 'تعديل', en: 'Edit' },
  deleteHall: { fr: 'Supprimer', ar: 'حذف', en: 'Delete' },
  save: { fr: 'Enregistrer', ar: 'حفظ', en: 'Save' },
  cancel: { fr: 'Annuler', ar: 'إلغاء', en: 'Cancel' },
  hallName: { fr: 'Nom de la salle', ar: 'اسم القاعة', en: 'Venue name' },
  capacityMin: { fr: 'Capacité min', ar: 'السعة الدنيا', en: 'Min capacity' },
  capacityMax: { fr: 'Capacité max', ar: 'السعة القصوى', en: 'Max capacity' },
  priceDzd: { fr: 'Tarif (DA)', ar: 'السعر (دج)', en: 'Price (DZD)' },
  description: { fr: 'Description', ar: 'الوصف', en: 'Description' },
  photos: { fr: 'Photos', ar: 'الصور', en: 'Photos' },
  photoCount: { fr: 'photos', ar: 'صور', en: 'photos' },
  uploadPhoto: { fr: 'Ajouter une photo', ar: 'إضافة صورة', en: 'Upload photo' },
  deletePhoto: { fr: 'Supprimer', ar: 'حذف', en: 'Delete' },
  noHalls: { fr: 'Vous n’avez pas encore de salle.', ar: 'ليس لديكم أي قاعة بعد.', en: 'You have no venues yet.' },
  confirmDeleteHall: { fr: 'Supprimer cette salle ?', ar: 'حذف هذه القاعة؟', en: 'Delete this venue?' },
  hallSaved: { fr: 'Salle enregistrée.', ar: 'تم حفظ القاعة.', en: 'Venue saved.' },
  hallDeleted: { fr: 'Salle supprimée.', ar: 'تم حذف القاعة.', en: 'Venue deleted.' },
  newHallTitle: { fr: 'Nouvelle salle', ar: 'قاعة جديدة', en: 'New venue' },
  editHallTitle: { fr: 'Modifier la salle', ar: 'تعديل القاعة', en: 'Edit venue' },
  /* --- Task 05: AI venue advisor --- */
  aiAdvisor: { fr: 'Conseiller IA', ar: 'المستشار الذكي', en: 'AI Advisor' },
  advisorTitle: { fr: 'Conseiller IA — améliorez votre fiche', ar: 'المستشار الذكي — حسّنوا بطاقة قاعتكم', en: 'AI Advisor — improve your listing' },
  advisorPickPhotos: {
    fr: 'Sélectionnez 3 à 5 photos représentatives de la galerie, puis lancez l’analyse.',
    ar: 'اختاروا 3 إلى 5 صور تمثيلية من المعرض، ثم ابدأوا التحليل.',
    en: 'Select 3 to 5 representative photos from the gallery, then run the analysis.',
  },
  analyzeWithAI: { fr: 'Analyser avec l’IA', ar: 'حلّلوا بالذكاء الاصطناعي', en: 'Analyze with AI' },
  advisorAnalyzing: {
    fr: 'L’IA analyse la présentation de votre salle…',
    ar: 'الذكاء الاصطناعي يحلّل عرض قاعتكم…',
    en: 'AI is analyzing venue presentation...',
  },
  advisorNeedPhotos: {
    fr: 'Sélectionnez au moins une photo pour lancer l’analyse.',
    ar: 'اختاروا صورة واحدة على الأقل لبدء التحليل.',
    en: 'Select at least one photo to run the analysis.',
  },
  advisorFactsTitle: { fr: 'Fiche enregistrée', ar: 'البيانات المسجلة', en: 'Facts on file' },
  advStrengths: { fr: 'Points forts actuels', ar: 'نقاط القوة الحالية', en: 'Current Strengths' },
  advGallery: { fr: 'Observations sur la galerie', ar: 'ملاحظات على المعرض', en: 'Gallery Observations' },
  advViews: { fr: 'Angles et prises de vue recommandés', ar: 'زوايا ولقطات موصى بها للمعرض', en: 'Recommended Gallery Angles' },
  advListing: { fr: 'Améliorations de la fiche', ar: 'تحسينات بطاقة العرض', en: 'Listing Description Improvements' },
  advPresent: { fr: 'Conseils de présentation & scénographie', ar: 'نصائح العرض والسينوغرافيا', en: 'Presentation & Décor Suggestions' },
  advNext: { fr: 'Prochaines actions conseillées', ar: 'الخطوات التالية الموصى بها', en: 'Recommended Next Actions' },
  advisorDisclaimer: {
    fr: "Rapport d'aide à la décision généré par l'IA. Les modifications restent sous le contrôle exclusif du propriétaire.",
    ar: 'تقرير استشاري تم إنشاؤه بواسطة الذكاء الاصطناعي. تبقى التعديلات تحت السيطرة الكاملة للمالك.',
    en: "Decision support report generated by AI. Modifications remain entirely under the owner's control.",
  },
  /* --- 360° tour: viewer recovery + owner workflow + meta visibility --- */
  noTourPublished: {
    fr: 'Aucune visite virtuelle publiée pour cette salle pour le moment.',
    ar: 'لا توجد جولة افتراضية منشورة لهذه القاعة حالياً.',
    en: 'No published virtual tour for this venue yet.',
  },
  panoramaLoadError: {
    fr: 'Impossible de charger ce panorama. Vérifiez votre connexion puis réessayez.',
    ar: 'تعذر تحميل هذه البانوراما. تحققوا من الاتصال ثم حاولوا مجدداً.',
    en: 'Could not load this panorama. Check your connection and try again.',
  },
  returnToPrevious: {
    fr: 'Retour à la scène précédente',
    ar: 'عودة إلى المشهد السابق',
    en: 'Return to previous scene',
  },
  metaLive: {
    fr: '● EN DIRECT · Propulsé par Meta Muse Spark 1.3',
    ar: '● مباشر · مدعوم بـ Meta Muse Spark 1.3',
    en: '● LIVE · Powered by Meta Muse Spark 1.3',
  },
  metaCached: {
    fr: '○ DÉMO · Recommandation en cache',
    ar: '○ تجريبي · توصية مخزنة مؤقتاً',
    en: '○ DEMO · Cached recommendation',
  },
  tourSection: { fr: 'Visite virtuelle 360°', ar: 'الجولة الافتراضية 360°', en: '360° Virtual Tour' },
  tourNoScenes: {
    fr: 'Aucune scène 360° pour le moment. Importez un panorama équirectangulaire ci-dessous.',
    ar: 'لا توجد مشاهد 360° بعد. ارفعوا بانوراما إسقاطية أدناه.',
    en: 'No 360° scenes yet. Upload an equirectangular panorama below.',
  },
  tourFirstBadge: { fr: 'Scène de départ', ar: 'مشهد البداية', en: 'Starting scene' },
  tourMakeFirst: { fr: 'Définir comme départ', ar: 'تعيين كبداية', en: 'Set as start' },
  tourLinks: { fr: 'Liens', ar: 'الروابط', en: 'Links' },
  tourLinkTo: { fr: 'Relier vers…', ar: 'اربطوا نحو…', en: 'Link to…' },
  tourConnect: { fr: 'Connecter', ar: 'ربط', en: 'Connect' },
  tourUnlink: { fr: 'Retirer', ar: 'إزالة', en: 'Remove' },
  tourDeleteScene: { fr: 'Supprimer la scène', ar: 'حذف المشهد', en: 'Delete scene' },
  tourConfirmDelete: { fr: 'Supprimer cette scène 360° ?', ar: 'حذف هذا المشهد 360°؟', en: 'Delete this 360° scene?' },
  tourAddTitle: { fr: 'Ajouter une scène 360°', ar: 'إضافة مشهد 360°', en: 'Add a 360° scene' },
  tourSceneName: { fr: 'Nom de la scène', ar: 'اسم المشهد', en: 'Scene name' },
  tourSceneNamePh: { fr: 'ex. Entrée, Grande Salle, Espace VIP', ar: 'مثال: المدخل، القاعة الكبرى، فضاء VIP', en: 'e.g. Entrance, Main Ballroom, VIP Lounge' },
  tourChoosePano: { fr: 'Choisir un panorama', ar: 'اختاروا بانوراما', en: 'Choose a panorama' },
  tourUploadScene: { fr: 'Importer la scène', ar: 'رفع المشهد', en: 'Upload scene' },
  tourPreview: { fr: 'Tester la visite 360°', ar: 'معاينة الجولة 360°', en: 'Preview the 360° tour' },
  tourPreviewTitle: { fr: 'Aperçu de la visite 360°', ar: 'معاينة الجولة 360°', en: '360° tour preview' },
  tourHint: {
    fr: 'Panorama équirectangulaire ~2:1 (recommandé 4096×2048), JPG/PNG/WebP, 10 Mo max.',
    ar: 'بانوراما إسقاطية بنسبة ~2:1 (يُنصح بـ 4096×2048)، JPG/PNG/WebP، بحد أقصى 10 م.ب.',
    en: 'Equirectangular panorama ~2:1 (4096×2048 recommended), JPG/PNG/WebP, max 10MB.',
  },
  tourRatioErr: {
    fr: 'Image refusée : le panorama doit avoir un ratio ~2:1 (ex. 4096×2048).',
    ar: 'تم رفض الصورة: يجب أن تكون البانوراما بنسبة ~2:1 (مثال: 4096×2048).',
    en: 'Image rejected: the panorama must have a ~2:1 ratio (e.g. 4096×2048).',
  },
  tourSizeErr: {
    fr: 'Image refusée : 10 Mo maximum.',
    ar: 'تم رفض الصورة: الحد الأقصى 10 م.ب.',
    en: 'Image rejected: 10MB maximum.',
  },
  tourTypeErr: {
    fr: 'Image refusée : JPG, PNG ou WebP uniquement.',
    ar: 'تم رفض الصورة: JPG أو PNG أو WebP فقط.',
    en: 'Image rejected: JPG, PNG or WebP only.',
  },
  /* --- Task 07: quick UX corrections --- */
  panoRemove: { fr: 'Retirer', ar: 'إزالة', en: 'Remove' },
  panoRatioOk: { fr: '✓ Ratio 2:1 valide', ar: '✓ نسبة 2:1 صالحة', en: '✓ Valid 2:1 ratio' },
  panoRatioWarn: {
    fr: '⚠ Format non équirectangulaire (attendu ~2:1, ex. 4096×2048)',
    ar: '⚠ الصيغة ليست إسقاطية (المتوقع ~2:1، مثال: 4096×2048)',
    en: '⚠ Not equirectangular (expected ~2:1, e.g. 4096×2048)',
  },
  tourLinkedOk: { fr: '✓ Connecté !', ar: '✓ تم الربط!', en: '✓ Connected!' },
  tourUnlinkedOk: { fr: '✓ Lien retiré !', ar: '✓ تمت إزالة الرابط!', en: '✓ Link removed!' },
  tourFirstOk: { fr: '✓ Scène principale définie !', ar: '✓ تم تعيين المشهد الرئيسي!', en: '✓ Starting scene set!' },
  tourSceneAdded: { fr: 'Scène ajoutée !', ar: 'تمت إضافة المشهد!', en: 'Scene added!' },
  /* --- Task 08: multi-owner, applications, super admin --- */
  navAdmin: { fr: 'Administration', ar: 'الإدارة', en: 'Administration' },
  ownerApplyHint: { fr: 'Vous possédez une salle des fêtes ?', ar: 'هل تملكون قاعة حفلات؟', en: 'Do you own a wedding hall?' },
  ownerApplyCta: { fr: 'Espace Propriétaire — Déposer une candidature', ar: 'فضاء المالك — تقديم طلب', en: 'Owner Space — Submit an application' },
  ownerRegisterCta: { fr: "Devenir propriétaire d'une salle", ar: 'التسجيل كصاحب قاعة', en: 'Apply to become a hall owner' },
  ownerApprovalNote: {
    fr: "Les candidatures de propriétaires de salle nécessitent l'approbation du Super Admin.",
    ar: 'تخضع طلبات أصحاب القاعات لموافقة المشرف العام.',
    en: 'Hall owner applications require Super Admin approval.',
  },
  ownerRegTitle: { fr: 'Candidature propriétaire', ar: 'طلب مالك', en: 'Owner application' },
  ownerRegSub: {
    fr: 'Présentez votre établissement. L’administration examinera votre candidature avant d’activer votre espace opérationnel.',
    ar: 'قدّموا مؤسستكم. ستدرس الإدارة طلبكم قبل تفعيل فضاء عملكم.',
    en: 'Introduce your venue. Our team will review your application before activating your workspace.',
  },
  businessName: { fr: 'Nom de l’établissement', ar: 'اسم المؤسسة', en: 'Business name' },
  businessDesc: { fr: 'Présentation de l’activité', ar: 'وصف النشاط', en: 'Business description' },
  businessDescPh: {
    fr: 'ex. Salle de 400 places à Alger, mariages et fiançailles…',
    ar: 'مثال: قاعة 400 مقعد في الجزائر، أعراس وخطوبة…',
    en: 'e.g. 400-seat hall in Algiers, weddings and engagements…',
  },
  submitApplication: { fr: 'Envoyer ma candidature', ar: 'إرسال الطلب', en: 'Submit application' },
  backToLogin: { fr: 'Retour à la connexion', ar: 'عودة إلى الدخول', en: 'Back to sign in' },
  errInvalidPhone: { fr: 'Numéro de téléphone invalide.', ar: 'رقم هاتف غير صالح.', en: 'Invalid phone number.' },
  errInvalidBusiness: { fr: 'Veuillez saisir le nom de votre établissement.', ar: 'يرجى إدخال اسم المؤسسة.', en: 'Please enter your business name.' },
  errInvalidWilaya: { fr: 'Veuillez choisir une wilaya valide.', ar: 'يرجى اختيار ولاية صالحة.', en: 'Please choose a valid wilaya.' },
  errInvalidCommune: { fr: 'Veuillez saisir votre commune.', ar: 'يرجى إدخال البلدية.', en: 'Please enter your commune.' },
  errInvalidDesc: { fr: 'Veuillez présenter votre activité en quelques mots.', ar: 'يرجى وصف نشاطكم ببضع كلمات.', en: 'Please describe your business briefly.' },
  adminLoginTitle: { fr: 'Connexion administration', ar: 'دخول الإدارة', en: 'Administration sign in' },
  adminLoginSub: { fr: 'Réservé à l’administrateur de la plateforme.', ar: 'مخصص لمدير المنصة.', en: 'For platform administrators only.' },
  adminAccessDenied: { fr: 'Accès réservé à l’administrateur de la plateforme.', ar: 'الدخول مخصص لمدير المنصة فقط.', en: 'Access restricted to platform administrators.' },
  adminBadge: { fr: 'Administration', ar: 'الإدارة', en: 'Admin' },
  adminTitle: { fr: 'Tableau de bord — Administration', ar: 'لوحة التحكم — الإدارة', en: 'Dashboard — Administration' },
  adminSub: {
    fr: 'Validez les candidatures des propriétaires et suivez l’activité de la plateforme.',
    ar: 'صادقوا على طلبات المالكين وتابعوا نشاط المنصة.',
    en: 'Review owner applications and track marketplace activity.',
  },
  statCustomers: { fr: 'Clients', ar: 'الزبائن', en: 'Customers' },
  statOwners: { fr: 'Propriétaires', ar: 'المالكون', en: 'Owners' },
  statSuspended: { fr: 'Suspendus', ar: 'موقوفون', en: 'Suspended' },
  statHalls: { fr: 'Salles', ar: 'القاعات', en: 'Halls' },
  publishedHint: { fr: 'publiées', ar: 'منشورة', en: 'published' },
  ownersTitle: { fr: 'Candidatures des propriétaires', ar: 'طلبات المالكين', en: 'Owner applications' },
  noOwners: { fr: 'Aucune candidature pour le moment.', ar: 'لا طلبات حالياً.', en: 'No applications yet.' },
  colBusiness: { fr: 'Établissement', ar: 'المؤسسة', en: 'Business' },
  colOwner: { fr: 'Propriétaire', ar: 'المالك', en: 'Owner' },
  colContact: { fr: 'Contact', ar: 'الاتصال', en: 'Contact' },
  colLocation: { fr: 'Wilaya / Commune', ar: 'الولاية / البلدية', en: 'Wilaya / Commune' },
  colHalls: { fr: 'Salles', ar: 'القاعات', en: 'Halls' },
  btnApprove: { fr: 'Approuver', ar: 'قبول', en: 'Approve' },
  btnRefuse: { fr: 'Refuser', ar: 'رفض', en: 'Reject' },
  btnSuspend: { fr: 'Suspendre', ar: 'تعليق', en: 'Suspend' },
  btnReactivate: { fr: 'Réactiver', ar: 'إعادة تفعيل', en: 'Reactivate' },
  confirmStatusChange: { fr: 'Confirmer ce changement de statut ?', ar: 'تأكيد تغيير الحالة؟', en: 'Confirm this status change?' },
  statusPending: { fr: 'En attente', ar: 'قيد الانتظار', en: 'Pending' },
  statusApproved: { fr: 'Approuvé', ar: 'مقبول', en: 'Approved' },
  statusRejected: { fr: 'Refusé', ar: 'مرفوض', en: 'Rejected' },
  statusSuspended: { fr: 'Suspendu', ar: 'موقوف', en: 'Suspended' },
  ownerPendingTitle: { fr: 'Candidature en cours d’examen', ar: 'طلبكم قيد الدراسة', en: 'Application under review' },
  ownerPendingSub: {
    fr: 'Merci pour votre candidature. L’administration l’examine actuellement ; votre espace opérationnel sera activé dès validation. Vous serez notifié par e-mail.',
    ar: 'شكراً على طلبكم. تدرسه الإدارة حالياً؛ سيُفعَّل فضاء عملكم فور المصادقة. سنعلمكم عبر البريد.',
    en: 'Thank you for applying. Our team is reviewing your application; your operational workspace will unlock once approved. We will notify you by email.',
  },
  applicationDetails: { fr: 'Détails de la candidature', ar: 'تفاصيل الطلب', en: 'Application details' },
  submittedOn: { fr: 'Envoyée le', ar: 'تاريخ الإرسال', en: 'Submitted on' },
  ownerSuspendedTitle: { fr: 'Compte suspendu', ar: 'الحساب موقوف', en: 'Account suspended' },
  ownerSuspendedSub: {
    fr: 'Votre compte propriétaire a été suspendu par l’administration. Vos salles ne sont plus visibles publiquement. Contactez l’administration pour plus d’informations.',
    ar: 'علّقت الإدارة حسابكم. لم تعد قاعاتكم ظاهرة للعموم. اتصلوا بالإدارة لمزيد من المعلومات.',
    en: 'Your owner account has been suspended by the administration. Your halls are no longer publicly visible. Please contact the administration for details.',
  },
  ownerRejectedTitle: { fr: 'Candidature refusée', ar: 'تم رفض الطلب', en: 'Application rejected' },
  ownerRejectedSub: {
    fr: 'Votre candidature n’a pas été retenue. Vous pouvez contacter l’administration pour comprendre les motifs ou soumettre une nouvelle candidature.',
    ar: 'لم يُقبل طلبكم. يمكنكم الاتصال بالإدارة لفهم الأسباب أو تقديم طلب جديد.',
    en: 'Your application was not accepted. You may contact the administration to understand why or submit a new application.',
  },
};

const STYLE_I18N = {
  moderne: { fr: 'Moderne', ar: 'عصري', en: 'Modern' },
  traditionnel: { fr: 'Traditionnel', ar: 'تقليدي', en: 'Traditional' },
  oriental: { fr: 'Oriental', ar: 'شرقي', en: 'Oriental' },
  minimaliste: { fr: 'Minimaliste', ar: 'بسيط', en: 'Minimal' },
  exterieur: { fr: 'Extérieur', ar: 'خارجي', en: 'Outdoor' },
};

const AMENITY_I18N = {
  parking: { fr: 'Parking', ar: 'موقف سيارات', en: 'Parking' },
  clim: { fr: 'Climatisation', ar: 'تكييف', en: 'Air conditioning' },
  cuisine: { fr: 'Cuisine traiteur', ar: 'مطبخ', en: 'Catering kitchen' },
  sono: { fr: 'Sonorisation', ar: 'صوتيات', en: 'Sound system' },
  deco: { fr: 'Décoration incluse', ar: 'ديكور مشمول', en: 'Décor included' },
  vestiaire: { fr: 'Vestiaire', ar: 'حجرة ملابس', en: 'Cloakroom' },
  jardin: { fr: 'Jardin', ar: 'حديقة', en: 'Garden' },
  hebergement: { fr: 'Hébergement', ar: 'إقامة', en: 'Lodging' },
};

const AMENITY_KEYS = ['parking', 'clim', 'cuisine', 'sono', 'deco', 'vestiaire', 'jardin', 'hebergement'];

const PALETTE_I18N = {
  gold: { fr: 'Or & ivoire', ar: 'ذهبي وعاجي', en: 'Gold & ivory' },
  rose: { fr: 'Rose poudré', ar: 'وردي', en: 'Powder rose' },
  emerald: { fr: 'Émeraude', ar: 'زمردي', en: 'Emerald' },
  blue: { fr: 'Bleu nuit', ar: 'أزرق ليلي', en: 'Midnight blue' },
};

const SEG_COLORS = { stage: '#B89446', tables: '#4A6356', chairs: '#9E3B33', decor: '#35493E', entrance: '#1f3a5f', zone: '#666057' };

/* ---------------- curated venue photography ---------------- */
const _U = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=60`;
const HALL_PHOTOS = {
  'h-alger-royal': [_U('photo-1519167758481-83f550bb49b3'), _U('photo-1511795409834-ef04bbd61622'), _U('photo-1464366400600-7168b8af9bc3')],
  'h-alger-nour': [_U('photo-1511795409834-ef04bbd61622'), _U('photo-1414235077428-338989a2e8c0'), _U('photo-1519225421980-715cb0215aed')],
  'h-alger-jardin': [_U('photo-1469371670807-013ccf25f16a'), _U('photo-1507504031003-b417219a0fde'), _U('photo-1465495976277-4387d4b0b4c6')],
  'h-oran-mediterranee': [_U('photo-1519167758481-83f550bb49b3'), _U('photo-1464366400600-7168b8af9bc3'), _U('photo-1522673607200-164d1b6ce486')],
  'h-oran-emir': [_U('photo-1414235077428-338989a2e8c0'), _U('photo-1511795409834-ef04bbd61622'), _U('photo-1530103862676-de8c9debad1d')],
  'h-const-cirta': [_U('photo-1511578314322-379afb476865'), _U('photo-1519167758481-83f550bb49b3'), _U('photo-1520854221256-17451cc331bf')],
  'h-blida-verger': [_U('photo-1469371670807-013ccf25f16a'), _U('photo-1519225421980-715cb0215aed'), _U('photo-1465495976277-4387d4b0b4c6')],
  'h-setif-hodna': [_U('photo-1511795409834-ef04bbd61622'), _U('photo-1464366400600-7168b8af9bc3'), _U('photo-1530103862676-de8c9debad1d')],
  'h-annaba-rim': [_U('photo-1469371670807-013ccf25f16a'), _U('photo-1519167758481-83f550bb49b3'), _U('photo-1522673607200-164d1b6ce486')],
  'h-tizi-amazigh': [_U('photo-1511578314322-379afb476865'), _U('photo-1519225421980-715cb0215aed'), _U('photo-1464366400600-7168b8af9bc3')],
  'h-bejaia-gouraya': [_U('photo-1469371670807-013ccf25f16a'), _U('photo-1414235077428-338989a2e8c0'), _U('photo-1465495976277-4387d4b0b4c6')],
  'h-tlemcen-andalou': [_U('photo-1511578314322-379afb476865'), _U('photo-1464366400600-7168b8af9bc3'), _U('photo-1519167758481-83f550bb49b3')],
  'h-ouargla-sahara': [_U('photo-1507504031003-b417219a0fde'), _U('photo-1465495976277-4387d4b0b4c6'), _U('photo-1530103862676-de8c9debad1d')],
  'h-messaad-nouvelle': [_U('photo-1414235077428-338989a2e8c0'), _U('photo-1519225421980-715cb0215aed'), _U('photo-1530103862676-de8c9debad1d')],
};

function hallPhotos(id, hall) {
  if (hall && Array.isArray(hall.photos) && hall.photos.length) return hall.photos;
  if (HALL_PHOTOS[id]) return HALL_PHOTOS[id];
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = Object.values(HALL_PHOTOS).flat();
  return [pool[h % pool.length], pool[(h + 7) % pool.length], pool[(h + 13) % pool.length]];
}

/* ---------------- Task 04: default connected multi-scene 360 tour ---------------- */
function defaultTourScenes() {
  return [
    {
      id: 'entrance',
      title: { fr: 'Entrée / Réception', ar: 'المدخل / الاستقبال', en: 'Entrance / Reception' },
      panorama: 'https://pannellum.org/images/from-tree.jpg',
      hotSpots: [
        { pitch: -2.1, yaw: 132.9, text: 'Grande Salle', targetSceneId: 'ballroom' },
      ],
    },
    {
      id: 'ballroom',
      title: { fr: 'Grande Salle', ar: 'القاعة الكبرى', en: 'Main Ballroom' },
      panorama: 'https://pannellum.org/images/bma-0.jpg',
      hotSpots: [
        { pitch: -0.6, yaw: 37.1, text: 'Entrée / Réception', targetSceneId: 'entrance' },
      ],
    },
  ];
}

function tourSceneTitle(scene) {
  if (!scene) return '';
  if (typeof scene.title === 'string') return scene.title;
  return lt(scene.title) || scene.id || '';
}

/* ---------------- state ---------------- */
const state = {
  lang: localStorage.getItem('wa-lang') || 'fr',
  wilayas: [],
  results: [],
  criteria: {},
  activeBudget: null,
  ranking: null, // { mode, ranking:[{id,score,reason}] }
  aiFilled: {}, // search fields last back-filled by an AI run: { wilaya, commune, date, guests, budget, style, amenities[] }
  meta: { keyConfigured: false },
  lastAiMode: 'demo',
  initialLoaded: false,
  studio: { img: null, regions: null, segMode: null, concepts: null, decoMode: null },
  ownerFilter: { status: '', hallId: '', date: '' },
  user: null,
  ownerConfigured: false,
  ownerTab: 'inquiries',
  inquirySearch: '',
  ownerHalls: [],
};

const tr = (key) => (I18N[key] && (I18N[key][state.lang] || I18N[key].fr)) || key;
const lt = (obj) => (obj && (obj[state.lang] || obj.fr || obj.ar || obj.en)) || '';
const toBudgetInt = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

async function apiGet(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'request_failed'), { code: data.error });
  return data;
}

async function apiPut(path, body) {
  const r = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'request_failed'), { code: data.error });
  return data;
}

async function apiDelete(path, body) {
  const r = await fetch(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'request_failed'), { code: data.error });
  return data;
}

/* ---------------- deterministic hall art (offline SVG fallback) ---------------- */
function hallSvg(h) {
  let hash = 0;
  for (const c of h.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const bg = ['#35493E', '#4A6356', '#5d4a17', '#2b2620', '#1F1D1A'][hash % 5];
  const band = ['#B89446', '#F5ECD7', '#E6DFD1', '#C9A227', '#EBF1ED'][hash % 5];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">` +
    `<rect width="900" height="600" fill="${bg}"/>` +
    `<rect x="0" y="440" width="900" height="160" fill="${band}" opacity="0.9"/>` +
    `<ellipse cx="450" cy="250" rx="210" ry="110" fill="none" stroke="${band}" stroke-width="18"/>` +
    `<line x1="240" y1="250" x2="240" y2="440" stroke="${band}" stroke-width="18"/>` +
    `<line x1="660" y1="250" x2="660" y2="440" stroke="${band}" stroke-width="18"/>` +
    `<circle cx="140" cy="120" r="16" fill="${band}"/><circle cx="760" cy="120" r="16" fill="${band}"/>` +
    `<circle cx="220" cy="80" r="9" fill="${band}" opacity="0.7"/><circle cx="680" cy="80" r="9" fill="${band}" opacity="0.7"/>` +
    `</svg>`;
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
}

function hallArt(h, idx) {
  const photos = hallPhotos(h.id, h);
  const photo = photos[(idx || 0) % photos.length];
  return `url('${photo}'), ${hallSvg(h)}`;
}

/* ---------------- chrome ---------------- */
function brandDescriptor() {
  const full = tr('brandTagline');
  const parts = String(full).split('·');
  return parts.length > 1 ? parts.slice(1).join('·').trim() : full;
}

function syncAdminNav() {
  const nav = $('.topnav');
  if (!nav) return;
  let link = $('[data-nav="admin"]', nav);
  if (state.user && state.user.role === 'super_admin') {
    if (!link) {
      link = document.createElement('a');
      link.href = '#/admin';
      link.dataset.nav = 'admin';
      nav.appendChild(link);
    }
    link.textContent = tr('navAdmin');
  } else if (link) {
    link.remove();
  }
}

function renderNavAuth() {
  const box = $('#navAuth');
  if (!box) return;
  if (state.user) {
    const dest = state.user.role === 'super_admin' ? '#/admin' : state.user.role === 'owner' ? '#/owner' : '#/account';
    const label = state.user.role === 'super_admin' ? tr('navAdmin') : state.user.role === 'owner' ? tr('navOwnerWorkspace') : tr('navMyAccount');
    box.innerHTML =
      `<a href="${dest}" class="user-pill" title="${esc(state.user.email || '')}"><span class="user-dot" aria-hidden="true">${esc((state.user.fullName || state.user.email || '?').slice(0, 1).toUpperCase())}</span><span class="user-name">${esc(state.user.fullName || '')}</span><span class="user-link">${esc(label)}</span></a>` +
      `<button id="btnSignOut" type="button" class="btn-sm btn-subtle" data-action="logout">${esc(tr('navSignOut'))}</button>`;
  } else {
    box.innerHTML =
      `<a href="#/login" class="btn-sm btn-subtle">${esc(tr('navSignIn'))}</a>` +
      `<a href="#/register" class="btn-sm btn-primary">${esc(tr('navSignUp'))}</a>`;
  }
}

async function doLogout() {
  try {
    await apiPost('/api/auth/logout', {});
  } catch { /* session already gone */ }
  state.user = null;
  renderNavAuth();
  syncAdminNav();
  if ((location.hash || '').startsWith('#/account') || (location.hash || '').startsWith('#/owner') || (location.hash || '').startsWith('#/admin')) {
    location.hash = '#/';
  } else {
    route();
  }
}

function applyLang() {
  document.documentElement.lang = state.lang === 'ar' ? 'ar-DZ' : state.lang === 'fr' ? 'fr-DZ' : 'en';
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  $$('.langsel button').forEach((b) => b.classList.toggle('on', b.dataset.lang === state.lang));
  const navSearch = $('[data-nav="search"]');
  if (navSearch) navSearch.textContent = tr('navSearch');
  const navStudio = $('[data-nav="studio"]');
  if (navStudio) navStudio.textContent = tr('navStudio');
  const navTrack = $('[data-nav="track"]');
  if (navTrack) navTrack.textContent = tr('navTrack');
  const navOwner = $('[data-nav="owner"]');
  if (navOwner) navOwner.textContent = tr('navOwner');
  const sub = $('#brandSubtitle');
  if (sub) sub.textContent = brandDescriptor();
  const foot = $('#footNote');
  if (foot) foot.textContent = tr('foot');
  renderNavAuth();
  syncAdminNav();
}

function setBadge(mode) {
  state.lastAiMode = mode === 'live' ? 'live' : 'demo';
  const b = $('#aiBadge');
  if (!b) return;
  if (state.lastAiMode === 'live') {
    b.className = 'aibadge live';
    b.textContent = tr('live');
  } else {
    b.className = 'aibadge demo';
    b.textContent = tr('demo');
  }
}

function modeTag(mode) {
  return `<span class="src ${mode === 'live' ? 'live' : 'cached'}">● ${mode === 'live' ? esc(tr('live')) : esc(tr('demo'))}</span>`;
}

// Honest explicit Meta status badge for discovery + advisor. LIVE appears only
// when the server reports mode:'live', i.e. a real Muse Spark reply arrived.
function metaTag(mode) {
  if (mode === 'live') return `<span class="meta-tag live">${esc(tr('metaLive'))}</span>`;
  return `<span class="meta-tag demo">${esc(tr('metaCached'))}</span>`;
}

function stName(status) {
  if (status === 'confirmed') return tr('statConfirmed');
  if (status === 'rejected') return tr('statRejected');
  return tr('pending');
}

function stPill(status) {
  const cls = status === 'confirmed' ? 'confirmed' : status === 'rejected' ? 'rejected' : '';
  return `<span class="status-pill ${cls}">${esc(stName(status))}</span>`;
}

function ratingPill(h) {
  return `<span class="rating-pill"><span class="star">★</span> ${esc(String(h.rating))} (${h.reviews})</span>`;
}

/* ---------------- views ---------------- */
function viewSearch() {
  const wilayaOpts = [`<option value="">${esc(tr('allWilayas'))}</option>`]
    .concat(state.wilayas.map((w) => `<option value="${w.code}">${w.code} — ${esc(lt(w))}</option>`))
    .join('');
  const styleOpts = [`<option value="">${esc(tr('anyStyle'))}</option>`]
    .concat(Object.keys(STYLE_I18N).map((s) => `<option value="${s}">${esc(STYLE_I18N[s][state.lang])}</option>`))
    .join('');
  const amenPills = AMENITY_KEYS
    .map((a) => `<span><input type="checkbox" id="am-${a}" name="amenities" value="${a}"><label for="am-${a}">${esc((AMENITY_I18N[a] || {})[state.lang] || a)}</label></span>`)
    .join('');
  const quickChips = ['qp1', 'qp2', 'qp3']
    .map((k) => `<button type="button" class="quick-chip" data-qp="${k}">${esc(tr(`${k}Label`))}</button>`)
    .join('');
  return `
  <section class="hero">
    <span class="demo-pill">${esc(tr('demoCatalog'))}</span>
    <h1>${esc(tr('hero'))}</h1>
    <p class="lead">${esc(tr('heroSub'))}</p>
  </section>
  <form id="searchForm" novalidate>
    <section class="concierge" aria-label="${esc(tr('conciergeTitle'))}">
      <div class="concierge-head"><h2>${esc(tr('conciergeTitle'))}</h2><span class="spark-tag">Muse Spark</span></div>
      <p class="hint">${esc(tr('conciergeHint'))}</p>
      <div class="field" style="margin-top:10px"><label for="fPrompt">${esc(tr('sparkPromptLabel'))}</label><textarea id="fPrompt" name="prompt" rows="2" maxlength="600" placeholder="${esc(tr('sparkPromptPh'))}"></textarea></div>
      <div class="quick-chips"><span class="hint">${esc(tr('quickLabel'))}</span>${quickChips}</div>
      <div class="btn-row">
        <button type="button" class="btn gold" id="btnRank">${esc(tr('aiRankBtn'))}</button>
      </div>
    </section>
    <section class="card" aria-label="${esc(tr('results'))}">
      <div class="filters-grid">
        <div class="field"><label for="fWilaya">${esc(tr('wilaya'))}</label><select id="fWilaya" name="wilaya">${wilayaOpts}</select></div>
        <div class="field"><label for="fCommune">${esc(tr('commune'))}</label><input id="fCommune" name="commune" placeholder="${esc(tr('communePh'))}" maxlength="60"></div>
        <div class="field"><label for="fDate">${esc(tr('date'))}</label><input id="fDate" name="date" type="date"></div>
        <div class="field"><label for="fGuests">${esc(tr('guests'))}</label><input id="fGuests" name="guests" type="number" min="1" max="5000" inputmode="numeric"></div>
        <div class="field"><label for="fBudget">${esc(tr('budget'))}</label><input id="fBudget" name="budget" type="number" min="1000" step="1000" inputmode="numeric"></div>
        <div class="field"><label for="fStyle">${esc(tr('style'))}</label><select id="fStyle" name="style">${styleOpts}</select></div>
        <div class="field full"><label>${esc(tr('amenities'))}</label><div class="amenity-pills" role="group">${amenPills}</div></div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn" id="btnSearch">${esc(tr('searchBtn'))}</button>
      </div>
    </section>
  </form>
  <div id="results"></div>`;
}

function rankReason(id) {
  if (!state.ranking) return '';
  const r = state.ranking.ranking.find((x) => x.id === id);
  if (!r) return '';
  return `<div class="rank">${metaTag(state.ranking.mode)} <b>${esc(String(r.score))}/100</b> — ${esc(r.reason)}</div>`;
}

function hallCard(h) {
  const wLabel = h.wilayaName ? `${h.wilaya} — ${esc(lt(h.wilayaName))}` : h.wilaya;
  const styles = h.styles.map((s) => `<span class="chip style">${esc(STYLE_I18N[s][state.lang])}</span>`).join('');
  const amens = h.amenities.map((a) => `<span class="chip amen">${esc((AMENITY_I18N[a] || {})[state.lang] || a)}</span>`).join('');
  const over = state.activeBudget != null && h.priceDzd > state.activeBudget
    ? `<span class="over-budget">${esc(tr('overBudget').replace('{amount}', fmtDzd(h.priceDzd - state.activeBudget, state.lang)))}</span>`
    : '';
  return `
  <article class="card hall">
    <div class="hall-art" style="background-image:${hallArt(h)}"><span class="demo-badge">${esc(tr('demoVenue'))}</span>${ratingPill(h)}</div>
    <div class="hall-body">
      <h3>${esc(lt(h.name))}</h3>
      <div class="meta">${esc(h.commune)}<span class="wilaya-tag">${wLabel}</span></div>
      <p class="hint">${esc(lt(h.desc))}</p>
      <div class="hall-stats">
        <div class="metric"><span>${esc(tr('capacity'))}</span><b>${h.capacityMin}–${h.capacityMax}</b></div>
        <div class="metric"><span>${esc(tr('price'))}</span><span class="price">${esc(fmtDzd(h.priceDzd, state.lang))}</span>${over}</div>
      </div>
      <div class="chips">${styles}${amens}</div>
      ${rankReason(h.id)}
      <div class="btn-row">
        <a class="btn" href="#/hall/${esc(h.id)}">${esc(tr('details'))}</a>
        <a class="btn ghost" href="#/inquiry/${esc(h.id)}">${esc(tr('book'))}</a>
      </div>
    </div>
  </article>`;
}

function extractedBar() {
  const rank = state.ranking;
  const ex = rank && rank.extractedCriteria;
  if (!rank || !rank.promptUsed || !ex || !Object.keys(ex).length) return '';
  const chips = [];
  if (ex.wilaya) {
    const w = state.wilayas.find((x) => x.code === ex.wilaya);
    chips.push(`<span class="chip">${esc(tr('wilaya'))}: ${esc(ex.wilaya)}${w ? ` — ${esc(lt(w))}` : ''}</span>`);
  }
  if (ex.commune) chips.push(`<span class="chip">${esc(tr('commune'))}: ${esc(ex.commune)}</span>`);
  if (ex.date) chips.push(`<span class="chip">${esc(ex.date)}</span>`);
  if (ex.month) chips.push(`<span class="chip">${esc(tr('date'))}: ${esc(String(ex.month))}</span>`);
  if (ex.guests != null) chips.push(`<span class="chip">${esc(tr('guests'))}: ${esc(String(ex.guests))}</span>`);
  if (ex.budget != null) chips.push(`<span class="chip">${esc(tr('budget'))}: ${esc(fmtDzd(ex.budget, state.lang))}</span>`);
  if (ex.style) chips.push(`<span class="chip">${esc((STYLE_I18N[ex.style] || {})[state.lang] || ex.style)}</span>`);
  if (Array.isArray(ex.amenities)) {
    ex.amenities.forEach((a) => chips.push(`<span class="chip">${esc((AMENITY_I18N[a] || {})[state.lang] || a)}</span>`));
  }
  if (!chips.length) return '';
  return `<div class="card slim extracted"><div><b>${esc(tr('extractedLabel'))}</b><button type="button" class="btn-sm btn-subtle" id="btnClearAiCriteria" style="margin-inline-start:8px;font-size:0.75rem">${esc(tr('clearAiCriteria'))}</button></div><div class="chips">${chips.join('')}</div></div>`;
}

function renderResults(note) {
  const el = $('#results');
  if (!el) return;
  const bar = extractedBar();
  if (!state.results.length) {
    el.innerHTML = `${bar}<div class="card slim"><p>${esc(tr('noResults'))}</p></div>`;
    const clearBtn = $('#btnClearAiCriteria');
    if (clearBtn) clearBtn.addEventListener('click', clearAiCriteria);
    return;
  }
  let list = state.results.slice();
  if (state.ranking) {
    const order = new Map(state.ranking.ranking.map((r, i) => [r.id, i]));
    list.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }
  el.innerHTML = `${bar}<h2 id="resultsTitle" tabindex="-1">${esc(tr('results'))} — ${list.length} ${esc(tr('hallsFound'))}</h2>` +
    (note ? `<p class="hint">${esc(note)}</p>` : '') +
    `<div class="hall-grid">${list.map(hallCard).join('')}</div>`;
  const clearBtn = $('#btnClearAiCriteria');
  if (clearBtn) clearBtn.addEventListener('click', clearAiCriteria);
}

function galleryPhotos(h) {
  const uploaded = Array.isArray(h.photos) ? h.photos.filter((p) => typeof p === 'string' && p) : [];
  const curated = hallPhotos(h.id);
  const out = [...uploaded];
  for (const c of curated) {
    if (out.length >= 3) break;
    if (!out.includes(c)) out.push(c);
  }
  while (out.length < 3) out.push(curated[out.length % curated.length]);
  return out.slice(0, Math.max(3, uploaded.length));
}

function viewHall(h) {
  const chips = h.amenities.map((a) => `<span class="chip amen">${esc((AMENITY_I18N[a] || {})[state.lang] || a)}</span>`).join('');
  const styles = h.styles.map((s) => `<span class="chip style">${esc(STYLE_I18N[s][state.lang])}</span>`).join('');
  const gPhotos = galleryPhotos(h);
  const gMain = gPhotos[0];
  const gOthers = gPhotos.slice(1, 3);
  return `
  <div class="card slim"><div class="crumb-row"><a href="#/">← ${esc(tr('backSearch'))}</a><span class="demo-badge">${esc(tr('demoRecord'))}</span></div></div>
  <div class="card">
    <div class="hall-gallery">
      <button type="button" class="g-item g-main active" style="background-image:url('${gMain}'), ${hallSvg(h)}" aria-label="${esc(tr('photoView'))} 1"></button>
      ${gOthers.map((p, i) => `<button type="button" class="g-item" style="background-image:url('${p}'), ${hallSvg(h)}" aria-label="${esc(tr('photoView'))} ${i + 2}"></button>`).join('')}
    </div>
    <div class="detail-head">
      <div>
        <h1>${esc(lt(h.name))}</h1>
        <p class="hint">${esc(h.commune)} · ${h.wilaya} — ${esc(lt(h.wilayaName || {}))}</p>
        <p>${ratingPill(h)} <span class="hint">${h.reviews} ${esc(tr('reviews'))}</span></p>
        <p>${esc(lt(h.desc))}</p>
        <dl class="kv">
          <dt>${esc(tr('capacity'))}</dt><dd>${h.capacityMin} – ${h.capacityMax} ${esc(tr('guests'))}</dd>
          <dt>${esc(tr('price'))}</dt><dd><span class="price">${esc(fmtDzd(h.priceDzd, state.lang))}</span></dd>
          <dt>${esc(tr('styles'))}</dt><dd><span class="chips">${styles}</span></dd>
        </dl>
        <h2>${esc(tr('amenities'))}</h2>
        <div class="chips">${chips}</div>
        ${rankReason(h.id)}
      </div>
      <aside class="book-box">
        <div>${esc(tr('price'))}</div>
        <div class="price">${esc(fmtDzd(h.priceDzd, state.lang))}</div>
        <p class="hint">${h.capacityMin} – ${h.capacityMax} ${esc(tr('guests'))}</p>
        <p class="policy">${esc(tr('pendingPolicy'))}</p>
        <a class="btn gold" href="#/inquiry/${esc(h.id)}">${esc(tr('book'))}</a>
      </aside>
    </div>
  </div>
  <div class="card">
    <h2>${esc(tr('tour'))}</h2>
    <p class="hint">${esc(tr('tourSample'))} ${modeTag('cached')}</p>
    <div class="btn-row"><button class="btn ghost" id="btnTour">${esc(tr('tourLoad'))}</button></div>
    <div id="pano" hidden></div>
  </div>
  ${inquiryFormCard(h)}`;
}

function bindGallery() {
  const items = $$('.hall-gallery .g-item');
  const main = $('.hall-gallery .g-main');
  if (!main || items.length < 2) return;
  items.forEach((it) => it.addEventListener('click', () => {
    if (it === main) return;
    const tmp = main.style.backgroundImage;
    main.style.backgroundImage = it.style.backgroundImage;
    it.style.backgroundImage = tmp;
    items.forEach((x) => x.classList.remove('active'));
    main.classList.add('active');
  }));
}

function viewStudio(hall) {
  const styleRadios = Object.keys(STYLE_I18N)
    .map((s, i) => `<label><input type="radio" name="style" value="${s}"${i === 0 ? ' checked' : ''}>${esc(STYLE_I18N[s][state.lang])}</label>`)
    .join('');
  const palRadios = Object.keys(PALETTE_I18N)
    .map((p, i) => `<label><input type="radio" name="palette" value="${p}"${i === 0 ? ' checked' : ''}>${esc(PALETTE_I18N[p][state.lang])}</label>`)
    .join('');
  return `
  <div class="card slim"><a href="#/">← ${esc(tr('backSearch'))}</a>${hall ? ` · <b>${esc(lt(hall.name))}</b>` : ''}</div>
  <div class="card section-band">
    <h1>${esc(tr('studioTitle'))}</h1>
    <p class="lead">${esc(tr('studioSub'))}</p>
  </div>
  <div class="studio-grid">
    <div class="card">
      <h2>SAM 3.1 — ${esc(tr('segmented'))}</h2>
      <div class="btn-row" style="margin-top:0">
        <label class="btn ghost" for="fileUp" style="cursor:pointer">${esc(tr('upload'))}</label>
        <input type="file" id="fileUp" accept="image/jpeg,image/png,image/webp" hidden>
        <button class="btn" id="btnSeg">${esc(tr('segment'))}</button>
      </div>
      <p class="hint" id="segNote"></p>
      <div class="canvas-wrap" style="margin-top:10px"><canvas id="cv" width="640" height="400"></canvas></div>
      <ul class="legend" id="legend"></ul>
    </div>
    <div class="card">
      <h2>Muse Image — ${esc(tr('concepts'))}</h2>
      <div class="field"><label>${esc(tr('style'))}</label><div class="radio-cards">${styleRadios}</div></div>
      <div class="field" style="margin-top:10px"><label>${esc(tr('palette'))}</label><div class="radio-cards">${palRadios}</div></div>
      <div class="field" style="margin-top:10px"><label for="decoNotes">${esc(tr('notes'))}</label><textarea id="decoNotes" placeholder="${esc(tr('notesPh'))}" maxlength="500"></textarea></div>
      <div class="btn-row"><button class="btn gold" id="btnDeco">${esc(tr('generate'))}</button></div>
      <p class="hint" id="decoNote"></p>
      <div id="concepts" class="grid" style="margin-top:10px"></div>
    </div>
  </div>`;
}

function inquiryFormCard(h) {
  const preName = state.user ? esc(state.user.fullName || '') : '';
  const authNote = state.user
    ? `<p class="auth-note"><span class="user-dot sm" aria-hidden="true">${esc(((state.user.fullName || state.user.email || '?').slice(0, 1) || '?').toUpperCase())}</span> ${esc(tr('bookingAs'))} <b>${esc(state.user.fullName || '')}</b> · ${esc(tr('bookingAsNote'))}</p>`
    : `<p class="hint">${esc(tr('guestNote'))} <a href="#/register">${esc(tr('navSignUp'))}</a> · <a href="#/login">${esc(tr('navSignIn'))}</a></p>`;
  return `
    <div class="card section-band" id="inquiryCard">
      <h2>${esc(tr('inquiryTitle'))} — ${esc(lt(h.name))}</h2>
      <p class="lead">${esc(tr('inquirySub'))}</p>
      ${authNote}
      <form id="inqForm">
        <div class="field-row">
          <div class="field"><label for="qName">${esc(tr('name'))}</label><input id="qName" maxlength="80" required value="${preName}"></div>
          <div class="field"><label for="qPhone">${esc(tr('phone'))}</label><input id="qPhone" inputmode="tel" required></div>
        </div>
        <div class="field-row" style="margin-top:10px">
          <div class="field"><label for="qDate">${esc(tr('date'))}</label><input id="qDate" type="date" required></div>
          <div class="field"><label for="qGuests">${esc(tr('guests'))}</label><input id="qGuests" type="number" min="1" max="5000" required></div>
        </div>
        <div class="field" style="margin-top:10px"><label for="qMsg">${esc(tr('message'))}</label><textarea id="qMsg" maxlength="1000"></textarea></div>
        <label class="consent"><input type="checkbox" id="qConsent"><span>${esc(tr('consent'))}</span></label>
        <p class="error" id="inqErr" hidden></p>
        <div class="btn-row"><button class="btn" type="submit">${esc(tr('send'))}</button></div>
      </form>
    </div>`;
}

function viewInquiry(h) {
  return `
  <div class="card slim"><a href="#/hall/${esc(h.id)}">← ${esc(lt(h.name))}</a></div>
  <div class="inquiry-layout">
    <aside class="card venue-summary">
      <div class="hall-art" style="background-image:${hallArt(h)}"><span class="demo-badge">${esc(tr('demoVenue'))}</span>${ratingPill(h)}</div>
      <div class="hall-body">
        <h3>${esc(lt(h.name))}</h3>
        <div class="meta">${esc(h.commune)} · ${h.wilaya} — ${esc(lt(h.wilayaName || {}))}</div>
        <div class="hall-stats">
          <div class="metric"><span>${esc(tr('price'))}</span><span class="price">${esc(fmtDzd(h.priceDzd, state.lang))}</span></div>
          <div class="metric"><span>${esc(tr('capacity'))}</span><b>${h.capacityMin}–${h.capacityMax}</b></div>
        </div>
      </div>
    </aside>
    ${inquiryFormCard(h)}
  </div>`;
}

function viewConfirm(ref) {
  const acctBtn = state.user && state.user.role !== 'owner'
    ? `<a class="btn gold" href="#/account">${esc(tr('viewInAccount'))}</a>`
    : '';
  return `
  <div class="card confirm section-band">
    <h1>${esc(tr('confirmTitle'))}</h1>
    <div>${esc(tr('yourRef'))}</div>
    <div class="ref" dir="ltr">${esc(ref)}</div>
    <div id="confStatus" style="margin-top:8px"></div>
    <p class="lead" style="margin:12px auto 0">${esc(tr('confirmNote'))}</p>
    <div class="btn-row" style="justify-content:center">${acctBtn}<a class="btn" href="#/track/${esc(ref)}">${esc(tr('trackBtn'))}</a><a class="btn ghost" href="#/">${esc(tr('backSearch'))}</a></div>
  </div>`;
}

function ownerCard(i) {
  const decided = i.status !== 'pending'
    ? `<p class="hint">${esc(tr('decidedOn'))} : ${esc((i.decidedAt || '').slice(0, 10))}${i.ownerNote ? ` — ${esc(i.ownerNote)}` : ''}</p>`
    : '';
  const actions = i.status === 'pending'
    ? `<div class="field" style="margin-top:8px"><label>${esc(tr('ownerNote'))}</label><input data-note="${esc(i.reference)}" maxlength="500"></div>
       <div class="btn-row">
         <button class="btn" data-decide="accept" data-ref="${esc(i.reference)}">${esc(tr('accept'))}</button>
         <button class="btn ghost" data-decide="reject" data-ref="${esc(i.reference)}">${esc(tr('reject'))}</button>
       </div>`
    : '';
  return `
  <div class="inq">
    <div class="inq-head"><span class="inq-ref" dir="ltr">${esc(i.reference)}</span>${stPill(i.status)}</div>
    <div class="inq-meta">
      <div><div class="k">${esc(tr('filterHall'))}</div><div><b>${esc(lt(i.hallName))}</b> <span class="hint">(${esc(i.hallId)} · ${esc(i.wilaya)})</span></div></div>
      <div><div class="k">${esc(tr('client'))}</div><div>${esc(i.name)} · <span dir="ltr">${esc(i.phone)}</span></div></div>
      <div><div class="k">${esc(tr('event'))}</div><div>${esc(i.date)} · ${esc(String(i.guests))} ${esc(tr('guests'))}</div></div>
      <div><div class="k">${esc(tr('requestedOn'))}</div><div>${esc((i.createdAt || '').slice(0, 10))}</div></div>
    </div>
    ${i.message ? `<p class="inq-msg msg-quote hint">“${esc(i.message)}”</p>` : ''}
    ${decided}${actions}
  </div>`;
}

function viewOwner(data, halls, f) {
  const c = data.counts || { total: 0, pending: 0, confirmed: 0, rejected: 0 };
  const list = data.inquiries || [];
  const statusOpts = [`<option value="">${esc(tr('allStatuses'))}</option>`, 'pending', 'confirmed', 'rejected']
    .map((s, idx) => (idx === 0 ? s : `<option value="${s}"${f.status === s ? ' selected' : ''}>${esc(stName(s))}</option>`))
    .join('');
  const hallOpts = [`<option value="">${esc(tr('allHalls'))}</option>`]
    .concat(halls.map((h) => `<option value="${esc(h.id)}"${f.hallId === h.id ? ' selected' : ''}>${esc(lt(h.name))}</option>`))
    .join('');
  const byDate = new Map();
  list.forEach((i) => {
    if (!byDate.has(i.date)) byDate.set(i.date, []);
    byDate.get(i.date).push(i);
  });
  const overview = Array.from(byDate.keys()).sort().map((d) => `
    <div class="day-group"><h4 dir="ltr">${esc(d)}</h4>
      ${byDate.get(d).map((i) => `<div class="day-row"><span dir="ltr"><b>${esc(i.reference)}</b></span>${stPill(i.status)}<span>${esc(lt(i.hallName))} · ${esc(String(i.guests))}</span></div>`).join('')}
    </div>`).join('') || `<p class="hint">${esc(tr('noInquiries'))}</p>`;
  return `
  <div class="demo-banner">${esc(tr('ownerDemo'))}</div>
  <h1>${esc(tr('ownerTitle'))}</h1>
  <div class="stats">
    <div class="stat"><b>${c.total}</b><span>${esc(tr('statTotal'))}</span></div>
    <div class="stat"><b>${c.pending}</b><span>${esc(tr('statPending'))}</span></div>
    <div class="stat"><b>${c.confirmed}</b><span>${esc(tr('statConfirmed'))}</span></div>
    <div class="stat"><b>${c.rejected}</b><span>${esc(tr('statRejected'))}</span></div>
  </div>
  <div class="card"><div class="owner-filters">
    <div class="field"><label for="oStatus">${esc(tr('filterStatus'))}</label><select id="oStatus">${statusOpts}</select></div>
    <div class="field"><label for="oHall">${esc(tr('filterHall'))}</label><select id="oHall">${hallOpts}</select></div>
    <div class="field"><label for="oDate">${esc(tr('filterDate'))}</label><input id="oDate" type="date" value="${esc(f.date || '')}"></div>
  </div></div>
  <div class="owner-workspace">
    <div class="card"><h2>${esc(tr('overview'))}</h2>${overview}</div>
    <div class="card"><h2>${esc(tr('statTotal'))} — ${list.length}</h2>
      <p class="error" id="ownerErr" hidden></p>
      ${list.length ? list.map(ownerCard).join('') : `<p class="hint">${esc(tr('noInquiries'))}</p>`}
    </div>
  </div>`;
}

function viewTrack(initialRef) {
  return `
  <div class="card section-band" style="max-width:640px;margin-inline:auto">
    <h1>${esc(tr('trackTitle'))}</h1>
    <p class="lead">${esc(tr('trackSub'))}</p>
    <form id="trackForm" class="field-row" style="margin-top:12px">
      <div class="field"><input id="trackRef" dir="ltr" placeholder="WAL-XXXXXX" maxlength="12" value="${esc(initialRef || '')}" style="text-transform:uppercase"></div>
      <div><button class="btn" type="submit">${esc(tr('trackBtn'))}</button></div>
    </form>
    <div id="trackResult" style="margin-top:14px"></div>
  </div>`;
}

function trackResultHtml(i) {
  return `
    <div class="inq-head"><span class="inq-ref" dir="ltr">${esc(i.reference)}</span>${stPill(i.status)}</div>
    <p><b>${esc(lt(i.hallName))}</b></p>
    <p>${esc(i.date)} · ${esc(String(i.guests))} ${esc(tr('guests'))}</p>
    ${i.message ? `<p class="hint">“${esc(i.message)}”</p>` : ''}
    <p><b>${esc(tr('ownerResponse'))}</b> : ${i.ownerNote ? esc(i.ownerNote) : esc(tr('noResponse'))}</p>`;
}

/* ---------------- auth views ---------------- */
function viewLogin() {
  return `
  <div class="card auth-card section-band">
    <h1>${esc(tr('loginTitle'))}</h1>
    <p class="lead">${esc(tr('loginSub'))}</p>
    <form id="loginForm" novalidate>
      <div class="field"><label for="lEmail">${esc(tr('email'))}</label><input id="lEmail" type="email" autocomplete="email" required dir="ltr"></div>
      <div class="field" style="margin-top:10px"><label for="lPass">${esc(tr('password'))}</label><input id="lPass" type="password" autocomplete="current-password" required></div>
      <p class="error" id="loginErr" hidden></p>
      <div class="btn-row"><button class="btn gold" type="submit">${esc(tr('loginBtn'))}</button></div>
    </form>
    <p class="hint" style="margin-top:12px">${esc(tr('noAccountYet'))} <a href="#/register">${esc(tr('navSignUp'))}</a></p>
    <p class="hint owner-apply">${esc(tr('ownerApplyHint'))} <a href="#/owner/register">${esc(tr('ownerApplyCta'))}</a></p>
  </div>`;
}

function viewRegister() {
  return `
  <div class="card auth-card section-band">
    <h1>${esc(tr('registerTitle'))}</h1>
    <p class="lead">${esc(tr('registerSub'))}</p>
    <form id="regForm" novalidate>
      <div class="field"><label for="rName">${esc(tr('fullName'))}</label><input id="rName" maxlength="80" autocomplete="name" required></div>
      <div class="field" style="margin-top:10px"><label for="rEmail">${esc(tr('email'))}</label><input id="rEmail" type="email" autocomplete="email" required dir="ltr"></div>
      <div class="field" style="margin-top:10px"><label for="rPass">${esc(tr('password'))}</label><input id="rPass" type="password" autocomplete="new-password" required><p class="hint">${esc(tr('passwordHelp'))}</p></div>
      <div class="field" style="margin-top:10px"><label for="rPass2">${esc(tr('confirmPassword'))}</label><input id="rPass2" type="password" autocomplete="new-password" required></div>
      <p class="error" id="regErr" hidden></p>
      <div class="btn-row"><button class="btn gold" type="submit">${esc(tr('createAccountBtn'))}</button></div>
    </form>
    <p class="hint" style="margin-top:12px">${esc(tr('alreadyHaveAccount'))} <a href="#/login">${esc(tr('navSignIn'))}</a></p>
    <p class="hint owner-apply">${esc(tr('ownerApplyHint'))} <a href="#/owner/register">${esc(tr('ownerApplyCta'))}</a></p>
  </div>`;
}

/* ---------------- Task 08: owner application + admin views ---------------- */
function ownerStatusName(s) {
  if (s === 'approved') return tr('statusApproved');
  if (s === 'rejected') return tr('statusRejected');
  if (s === 'suspended') return tr('statusSuspended');
  return tr('statusPending');
}

function ownerStatusPill(s) {
  const cls = s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : s === 'suspended' ? 'suspended' : 'pending';
  return `<span class="status-pill ${cls}">${esc(ownerStatusName(s))}</span>`;
}

function viewOwnerRegister() {
  const wilayaOpts = [`<option value="">—</option>`]
    .concat(state.wilayas.map((w) => `<option value="${w.code}">${w.code} — ${esc(lt(w))}</option>`))
    .join('');
  return `
  <div class="card auth-card section-band" style="max-width:640px">
    <h1>${esc(tr('ownerRegTitle'))}</h1>
    <p class="lead">${esc(tr('ownerRegSub'))}</p>
    <form id="ownerRegForm" novalidate>
      <div class="field"><label for="orName">${esc(tr('fullName'))}</label><input id="orName" maxlength="80" autocomplete="name" required></div>
      <div class="field-row" style="margin-top:10px">
        <div class="field"><label for="orEmail">${esc(tr('email'))}</label><input id="orEmail" type="email" autocomplete="email" required dir="ltr"></div>
        <div class="field"><label for="orPhone">${esc(tr('phone'))}</label><input id="orPhone" inputmode="tel" required dir="ltr"></div>
      </div>
      <div class="field" style="margin-top:10px"><label for="orBusiness">${esc(tr('businessName'))}</label><input id="orBusiness" maxlength="120" required></div>
      <div class="field-row" style="margin-top:10px">
        <div class="field"><label for="orWilaya">${esc(tr('wilaya'))}</label><select id="orWilaya" required>${wilayaOpts}</select></div>
        <div class="field"><label for="orCommune">${esc(tr('commune'))}</label><input id="orCommune" maxlength="60" required></div>
      </div>
      <div class="field" style="margin-top:10px"><label for="orDesc">${esc(tr('businessDesc'))}</label><textarea id="orDesc" maxlength="1000" placeholder="${esc(tr('businessDescPh'))}" required></textarea></div>
      <div class="field" style="margin-top:10px"><label for="orPass">${esc(tr('password'))}</label><input id="orPass" type="password" autocomplete="new-password" required><p class="hint">${esc(tr('passwordHelp'))}</p></div>
      <div class="field" style="margin-top:10px"><label for="orPass2">${esc(tr('confirmPassword'))}</label><input id="orPass2" type="password" autocomplete="new-password" required></div>
      <p class="error" id="ownerRegErr" hidden></p>
      <div class="btn-row"><button class="btn gold" type="submit">${esc(tr('submitApplication'))}</button></div>
    </form>
    <p class="hint" style="margin-top:12px"><a href="#/owner">${esc(tr('backToLogin'))}</a></p>
  </div>`;
}

function viewOwnerPending(user) {
  const u = user || {};
  return `
  <div class="card section-band status-card">
    <div class="status-head">${ownerStatusPill('pending')}</div>
    <h1>${esc(tr('ownerPendingTitle'))}</h1>
    <p class="lead"><b>${esc(u.businessName || '')}</b></p>
    <p class="lead">${esc(tr('ownerPendingSub'))}</p>
    <h2>${esc(tr('applicationDetails'))}</h2>
    <dl class="kv">
      <dt>${esc(tr('colBusiness'))}</dt><dd>${esc(u.businessName || '—')}</dd>
      <dt>${esc(tr('colOwner'))}</dt><dd>${esc(u.fullName || '')}</dd>
      <dt>${esc(tr('email'))}</dt><dd dir="ltr">${esc(u.email || '')}</dd>
      <dt>${esc(tr('phone'))}</dt><dd dir="ltr">${esc(u.phone || '—')}</dd>
      <dt>${esc(tr('colLocation'))}</dt><dd>${esc([u.wilaya, u.commune].filter(Boolean).join(' · ') || '—')}</dd>
      <dt>${esc(tr('submittedOn'))}</dt><dd dir="ltr">${esc(String(u.createdAt || '').slice(0, 10) || '—')}</dd>
    </dl>
    ${u.businessDescription ? `<p class="hint">“${esc(u.businessDescription)}”</p>` : ''}
    <div class="btn-row"><button type="button" class="btn-sm btn-subtle" data-action="logout">${esc(tr('navSignOut'))}</button></div>
  </div>`;
}

function viewOwnerBlocked(user) {
  const u = user || {};
  const st = u.status === 'suspended' ? 'suspended' : 'rejected';
  return `
  <div class="card section-band status-card">
    <div class="status-head">${ownerStatusPill(st)}</div>
    <h1>${esc(st === 'suspended' ? tr('ownerSuspendedTitle') : tr('ownerRejectedTitle'))}</h1>
    <p class="lead"><b>${esc(u.businessName || u.fullName || '')}</b></p>
    <p class="lead">${esc(st === 'suspended' ? tr('ownerSuspendedSub') : tr('ownerRejectedSub'))}</p>
    <div class="btn-row"><button type="button" class="btn-sm btn-subtle" data-action="logout">${esc(tr('navSignOut'))}</button></div>
  </div>`;
}

function viewAdminLogin() {
  return `
  <div class="card auth-card section-band">
    <span class="admin-badge">${esc(tr('adminBadge'))}</span>
    <h1>${esc(tr('adminLoginTitle'))}</h1>
    <p class="lead">${esc(tr('adminLoginSub'))}</p>
    <form id="adminLoginForm" novalidate>
      <div class="field"><label for="aEmail">${esc(tr('email'))}</label><input id="aEmail" type="email" autocomplete="email" required dir="ltr"></div>
      <div class="field" style="margin-top:10px"><label for="aPass">${esc(tr('password'))}</label><input id="aPass" type="password" autocomplete="current-password" required></div>
      <p class="error" id="adminLoginErr" hidden></p>
      <div class="btn-row"><button class="btn gold" type="submit">${esc(tr('loginBtn'))}</button></div>
    </form>
  </div>`;
}

function adminRowActions(o) {
  const s = o.status || 'approved';
  const btn = (st, label, cls) => `<button type="button" class="btn-sm ${cls}" data-admin-status="${st}" data-admin-id="${esc(o.id)}">${esc(label)}</button>`;
  if (s === 'pending') return btn('approved', tr('btnApprove'), 'btn-primary') + btn('rejected', tr('btnRefuse'), 'btn-subtle');
  if (s === 'approved') return btn('suspended', tr('btnSuspend'), 'btn-subtle');
  return btn('approved', tr('btnReactivate'), 'btn-primary');
}

function viewAdminDashboard(metrics, ownersResp) {
  const m = metrics || {};
  const owners = (ownersResp && ownersResp.owners) || [];
  const rows = owners.map((o) => {
    const loc = [o.wilaya, o.commune].filter(Boolean).join(' · ') || '—';
    return `<tr>
      <td><b>${esc(o.businessName || '—')}</b>${o.businessDescription ? `<div class="hint">${esc(String(o.businessDescription).slice(0, 140))}</div>` : ''}</td>
      <td>${esc(o.fullName || '')}<div class="hint" dir="ltr">${esc(String(o.createdAt || '').slice(0, 10))}</div></td>
      <td><span dir="ltr">${esc(o.email || '')}</span>${o.phone ? `<div dir="ltr">${esc(o.phone)}</div>` : ''}</td>
      <td>${esc(loc)}</td>
      <td>${ownerStatusPill(o.status || 'approved')}</td>
      <td>${esc(String(o.hallCount != null ? o.hallCount : 0))}</td>
      <td><div class="admin-actions">${adminRowActions(o)}</div></td>
    </tr>`;
  }).join('');
  return `
  <div class="owner-topbar">
    <div>
      <h1 style="margin:0">${esc(tr('adminTitle'))}</h1>
      <p class="hint" style="margin:4px 0 0"><span class="admin-badge">${esc(tr('adminBadge'))}</span> <span dir="ltr">${esc(state.user.email || '')}</span></p>
      <p class="lead" style="margin:6px 0 0">${esc(tr('adminSub'))}</p>
    </div>
    <button type="button" class="btn-sm btn-subtle" data-action="logout">${esc(tr('navSignOut'))}</button>
  </div>
  <div class="stats stats-6">
    <div class="stat"><b>${esc(String(m.totalCustomers != null ? m.totalCustomers : 0))}</b><span>${esc(tr('statCustomers'))}</span></div>
    <div class="stat"><b>${esc(String(m.totalOwners != null ? m.totalOwners : 0))}</b><span>${esc(tr('statOwners'))}</span></div>
    <div class="stat"><b>${esc(String(m.pendingOwners != null ? m.pendingOwners : 0))}</b><span>${esc(tr('statusPending'))}</span></div>
    <div class="stat"><b>${esc(String(m.approvedOwners != null ? m.approvedOwners : 0))}</b><span>${esc(tr('statusApproved'))}</span></div>
    <div class="stat"><b>${esc(String(m.suspendedOwners != null ? m.suspendedOwners : 0))}</b><span>${esc(tr('statusSuspended'))}</span></div>
    <div class="stat"><b>${esc(String(m.totalHalls != null ? m.totalHalls : 0))}</b><span>${esc(tr('statHalls'))} · ${esc(String(m.publishedHalls != null ? m.publishedHalls : 0))} ${esc(tr('publishedHint'))}</span></div>
  </div>
  <div class="card">
    <h2 style="margin-top:0">${esc(tr('ownersTitle'))} — ${owners.length}</h2>
    <p class="error" id="adminErr" hidden></p>
    ${owners.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr>
        <th>${esc(tr('colBusiness'))}</th>
        <th>${esc(tr('colOwner'))}</th>
        <th>${esc(tr('colContact'))}</th>
        <th>${esc(tr('colLocation'))}</th>
        <th>${esc(tr('colStatus'))}</th>
        <th>${esc(tr('colHalls'))}</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<p class="hint">${esc(tr('noOwners'))}</p>`}
  </div>`;
}

function viewCustomerAccount(data) {
  const c = (data && data.counts) || { total: 0, pending: 0, confirmed: 0, rejected: 0 };
  const list = (data && data.inquiries) || [];
  const cards = list.map((i) => `
    <article class="booking-card" data-ref="${esc(i.reference)}">
      <div class="booking-top"><span class="inq-ref" dir="ltr">${esc(i.reference)}</span>${stPill(i.status)}</div>
      <h3>${esc(lt(i.hallName))}</h3>
      <dl class="booking-meta">
        <div><dt>${esc(tr('colDate'))}</dt><dd dir="ltr">${esc(i.date)}</dd></div>
        <div><dt>${esc(tr('colGuests'))}</dt><dd>${esc(String(i.guests))}</dd></div>
        <div><dt>${esc(tr('colSubmitted'))}</dt><dd dir="ltr">${esc((i.createdAt || '').slice(0, 10))}</dd></div>
      </dl>
      <div class="btn-row"><button type="button" class="btn ghost btn-sm2" data-details="${esc(i.reference)}">${esc(tr('viewDetails'))}</button></div>
      <div class="booking-details" id="det-${esc(i.reference)}" hidden>
        <p><b>${esc(tr('yourMessage'))}</b></p>
        <p class="hint">${i.message ? esc(i.message) : '—'}</p>
        <p><b>${esc(tr('ownerNoteLabel'))}</b></p>
        <p class="hint">${i.ownerNote ? esc(i.ownerNote) : esc(tr('noNoteYet'))}</p>
        ${i.decidedAt ? `<p class="hint">${esc(tr('decidedOn'))} : <span dir="ltr">${esc(String(i.decidedAt).slice(0, 10))}</span></p>` : ''}
      </div>
    </article>`).join('');
  return `
  <section class="acct-head">
    <div>
      <h1>${esc(tr('custWelcome'))}, ${esc(state.user.fullName || '')}</h1>
      <p class="lead">${esc(tr('custDashSub'))}</p>
      <p><span class="email-badge" dir="ltr">${esc(state.user.email || '')}</span></p>
    </div>
  </section>
  <div class="stats">
    <div class="stat"><b>${c.total}</b><span>${esc(tr('statTotal'))}</span></div>
    <div class="stat"><b>${c.pending}</b><span>${esc(tr('statPending'))}</span></div>
    <div class="stat"><b>${c.confirmed}</b><span>${esc(tr('statConfirmed'))}</span></div>
    <div class="stat"><b>${c.rejected}</b><span>${esc(tr('statRejected'))}</span></div>
  </div>
  <h2>${esc(tr('custInquiriesTitle'))} — ${list.length}</h2>
  ${list.length ? `<div class="booking-grid">${cards}</div>` : `
  <div class="card empty-state">
    <p class="lead">${esc(tr('custNoInquiries'))}</p>
    <div class="btn-row"><a class="btn gold" href="#/">${esc(tr('browseHalls'))}</a></div>
  </div>`}
  <div id="acctModal" class="modal" hidden><div class="modal-card" role="dialog" aria-modal="true"><div id="acctModalBody"></div><div class="btn-row"><button type="button" class="btn ghost" id="acctModalClose">${esc(tr('close'))}</button></div></div></div>`;
}

/* ---------------- owner workspace views ---------------- */
function viewOwnerLogin() {
  return `
  <div class="card auth-card section-band">
    <span class="demo-pill">${esc(tr('demo'))}</span>
    <h1>${esc(tr('ownerLoginTitle'))}</h1>
    <p class="lead">${esc(tr('ownerLoginHint'))}</p>
    <form id="ownerLoginForm" novalidate>
      <div class="field"><label for="oEmail">${esc(tr('email'))}</label><input id="oEmail" type="email" autocomplete="email" required dir="ltr"></div>
      <div class="field" style="margin-top:10px"><label for="oPass">${esc(tr('password'))}</label><input id="oPass" type="password" autocomplete="current-password" required></div>
      <p class="error" id="ownerLoginErr" hidden></p>
      <div class="btn-row"><button class="btn gold" type="submit">${esc(tr('loginBtn'))}</button></div>
    </form>
    <p class="hint" style="margin-top:12px"><a href="#/owner/register">${esc(tr('ownerRegisterCta'))}</a></p>
    <p class="hint">${esc(tr('ownerApprovalNote'))}</p>
  </div>`;
}

function viewOwnerSetup() {
  return `
  <div class="card auth-card section-band">
    <h1>${esc(tr('ownerSetupTitle'))}</h1>
    <p class="lead">${esc(tr('ownerNotConfiguredHint'))}</p>
    <div class="code-hint" dir="ltr"><code>OWNER_EMAIL=owner@example.dz</code><br><code>OWNER_PASSWORD=choose-a-strong-password</code></div>
    <p class="hint" style="margin-top:12px"><a href="#/owner/register">${esc(tr('ownerRegisterCta'))}</a></p>
    <p class="hint">${esc(tr('ownerApprovalNote'))}</p>
  </div>`;
}

function nextEventDate(list) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = list.filter((i) => i.status === 'confirmed' && i.date >= today).map((i) => i.date).sort();
  if (upcoming.length) return upcoming[0];
  const any = list.filter((i) => i.status === 'confirmed').map((i) => i.date).sort();
  return any.length ? any[any.length - 1] : '';
}

function conflictFlags(inq, all) {
  const same = all.filter((x) => x.reference !== inq.reference && x.hallId === inq.hallId && x.date === inq.date);
  const hasConfirmed = inq.status !== 'confirmed' && same.some((x) => x.status === 'confirmed');
  const competing = inq.status === 'pending' ? same.filter((x) => x.status === 'pending').length : 0;
  return { hasConfirmed, competing };
}

function ownerCard(i, all) {
  const flags = conflictFlags(i, all || [i]);
  const conflictHtml = flags.hasConfirmed
    ? `<p class="conflict-banner hard"><b>${esc(tr('conflictExists'))}</b></p>`
    : (flags.competing > 0 ? `<p class="conflict-banner soft"><b>${esc(tr('conflictWarning'))}</b> · ${flags.competing + 1}</p>` : '');
  const decided = i.status !== 'pending'
    ? `<p class="hint">${esc(tr('decidedOn'))} : ${esc((i.decidedAt || '').slice(0, 10))}${i.ownerNote ? ` — ${esc(i.ownerNote)}` : ''}</p>`
    : '';
  const actions = i.status === 'pending'
    ? `<div class="field" style="margin-top:8px"><label>${esc(tr('ownerNote'))}</label><input data-note="${esc(i.reference)}" maxlength="500" placeholder="${esc(tr('addOwnerNotePh'))}"></div>
       <div class="btn-row">
         <button class="btn accept" data-decide="accept" data-ref="${esc(i.reference)}">${esc(tr('accept'))}</button>
         <button class="btn reject" data-decide="reject" data-ref="${esc(i.reference)}">${esc(tr('reject'))}</button>
       </div>`
    : '';
  return `
  <div class="inq${flags.hasConfirmed ? ' inq-conflict' : ''}">
    <div class="inq-head"><span class="inq-ref" dir="ltr">${esc(i.reference)}</span>${stPill(i.status)}</div>
    ${conflictHtml}
    <div class="inq-meta">
      <div><div class="k">${esc(tr('filterHall'))}</div><div><b>${esc(lt(i.hallName))}</b> <span class="hint">(${esc(i.hallId)} · ${esc(i.wilaya)})</span></div></div>
      <div><div class="k">${esc(tr('client'))}</div><div>${esc(i.name)} · <span dir="ltr">${esc(i.phone)}</span></div></div>
      <div><div class="k">${esc(tr('event'))}</div><div><span dir="ltr">${esc(i.date)}</span> · ${esc(String(i.guests))} ${esc(tr('guests'))}</div></div>
      <div><div class="k">${esc(tr('requestedOn'))}</div><div dir="ltr">${esc((i.createdAt || '').slice(0, 10))}</div></div>
    </div>
    ${i.message ? `<p class="inq-msg msg-quote hint">“${esc(i.message)}”</p>` : ''}
    ${decided}${actions}
  </div>`;
}

function ownerHallThumb(h) {
  const photos = galleryPhotos(h);
  return photos[0] || '';
}

function ownerHallCard(h) {
  const thumb = ownerHallThumb(h);
  const w = state.wilayas.find((x) => x.code === h.wilaya);
  const wLabel = w ? `${h.wilaya} — ${esc(lt(w))}` : esc(h.wilaya || '');
  const photoCount = Array.isArray(h.photos) ? h.photos.length : 0;
  return `
  <div class="inq owner-hall">
    <div class="owner-hall-row">
      <div class="owner-hall-thumb" style="background-image:url('${thumb}')" aria-hidden="true"></div>
      <div class="owner-hall-info">
        <div class="inq-head"><b>${esc(lt(h.name))}</b><span class="hint">(${esc(h.id)})</span></div>
        <div class="hint">${esc(h.commune || '')} · ${wLabel}</div>
        <div class="hall-stats">
          <div class="metric"><span>${esc(tr('capacity'))}</span><b>${h.capacityMin}–${h.capacityMax}</b></div>
          <div class="metric"><span>${esc(tr('price'))}</span><span class="price">${esc(fmtDzd(h.priceDzd, state.lang))}</span></div>
          <div class="metric"><span>${esc(tr('photos'))}</span><b>${photoCount}</b></div>
        </div>
      </div>
      <div class="owner-hall-actions">
        <button type="button" class="btn-sm btn-subtle" data-hall-edit="${esc(h.id)}">${esc(tr('editHall'))}</button>
        <button type="button" class="btn-sm btn-subtle" data-hall-delete="${esc(h.id)}">${esc(tr('deleteHall'))}</button>
        <button type="button" class="btn-sm btn-subtle" data-advisor="${esc(h.id)}">${esc(tr('aiAdvisor'))}</button>
      </div>
    </div>
  </div>`;
}

function tourSectionHtml(h) {
  const scenes = Array.isArray(h.tourScenes) ? h.tourScenes : [];
  const firstId = h.firstTourScene || (scenes[0] && scenes[0].id) || null;
  const titleOf = (id) => {
    const s = scenes.find((x) => x && x.id === id);
    return s ? (tourSceneTitle(s) || id) : id;
  };
  const cards = scenes.map((s) => {
    const spots = Array.isArray(s.hotSpots) ? s.hotSpots : [];
    const targets = spots.map((hp) => hp.targetSceneId || hp.sceneId).filter(Boolean);
    const others = scenes.filter((o) => o && o.id && o.id !== s.id);
    const linkChips = targets.length
      ? targets.map((t) => `<span class="chip amen">${esc(titleOf(t))} <button type="button" class="link-x" data-tour-unlink-from="${esc(s.id)}" data-tour-unlink-to="${esc(t)}" title="${esc(tr('tourUnlink'))}">×</button></span>`).join('')
      : `<span class="hint">—</span>`;
    const linker = others.length
      ? `<div class="tour-linker">
          <select id="linkSel-${esc(s.id)}" aria-label="${esc(tr('tourLinkTo'))}">
            ${others.map((o) => `<option value="${esc(o.id)}">${esc(titleOf(o.id))}</option>`).join('')}
          </select>
          <button type="button" class="btn-sm btn-subtle" data-tour-connect="${esc(s.id)}">${esc(tr('tourConnect'))}</button>
        </div>`
      : '';
    return `
      <div class="tour-scene">
        <div class="tour-thumb" style="background-image:url('${esc(s.panorama || '')}')"></div>
        <div class="tour-scene-body">
          <div class="tour-scene-head">
            <b>${esc(tourSceneTitle(s) || s.id)}</b>
            ${s.id === firstId ? `<span class="first-badge">${esc(tr('tourFirstBadge'))}</span>` : ''}
          </div>
          <div class="tour-links"><span class="hint">${esc(tr('tourLinks'))} :</span> ${linkChips}</div>
          ${linker}
          <div class="tour-scene-actions">
            ${s.id === firstId ? '' : `<button type="button" class="btn-sm btn-subtle" data-tour-first="${esc(s.id)}">${esc(tr('tourMakeFirst'))}</button>`}
            <button type="button" class="btn-sm btn-subtle danger" data-tour-del="${esc(s.id)}">${esc(tr('tourDeleteScene'))}</button>
          </div>
        </div>
      </div>`;
  }).join('');
  return `
      <div class="field tour-section" style="margin-top:14px">
        <h3 style="margin-bottom:4px">${esc(tr('tourSection'))}</h3>
        <p class="hint" style="margin-top:0">${esc(tr('tourHint'))}</p>
        <div class="tour-list">${scenes.length ? cards : `<p class="hint">${esc(tr('tourNoScenes'))}</p>`}</div>
        ${scenes.length ? `<div class="btn-row"><button type="button" class="btn ghost btn-sm2" id="btnPreviewTour">${esc(tr('tourPreview'))}</button></div>` : ''}
        <h4 style="margin:12px 0 6px">${esc(tr('tourAddTitle'))}</h4>
        <div class="field"><label for="tourSceneName">${esc(tr('tourSceneName'))}</label><input id="tourSceneName" maxlength="80" placeholder="${esc(tr('tourSceneNamePh'))}"></div>
        <div class="btn-row">
          <label class="btn ghost btn-sm2" for="tourPanoInput" style="cursor:pointer">${esc(tr('tourChoosePano'))}</label>
          <input type="file" id="tourPanoInput" accept="image/jpeg,image/png,image/webp" hidden>
          <button type="button" class="btn gold btn-sm2" id="btnUploadPano">${esc(tr('tourUploadScene'))}</button>
        </div>
        <div class="pano-selected" id="panoSelectedWrap" hidden>
          <span id="panoSelectedInfo" aria-live="polite"></span>
          <button type="button" class="btn-sm btn-subtle" id="btnClearPano">${esc(tr('panoRemove'))}</button>
        </div>
        <p class="hint" id="tourNote"></p>
      </div>`;
}

function hallModalHtml(hall) {
  const isEdit = !!hall;
  const h = hall || { name: { fr: '' }, wilaya: '', commune: '', capacityMin: '', capacityMax: '', priceDzd: '', styles: [], amenities: [], desc: { fr: '' }, phone: '' };
  const wilayaOpts = [`<option value="">—</option>`]
    .concat(state.wilayas.map((w) => `<option value="${w.code}"${h.wilaya === w.code ? ' selected' : ''}>${w.code} — ${esc(lt(w))}</option>`))
    .join('');
  const styleBoxes = Object.keys(STYLE_I18N)
    .map((s) => `<label><input type="checkbox" name="mStyles" value="${s}"${(h.styles || []).includes(s) ? ' checked' : ''}>${esc(STYLE_I18N[s][state.lang])}</label>`)
    .join('');
  const amenBoxes = AMENITY_KEYS
    .map((a) => `<label><input type="checkbox" name="mAmenities" value="${a}"${(h.amenities || []).includes(a) ? ' checked' : ''}>${esc((AMENITY_I18N[a] || {})[state.lang] || a)}</label>`)
    .join('');
  const photos = isEdit && Array.isArray(h.photos) ? h.photos : [];
  const photosHtml = isEdit ? `
      <div class="field" style="margin-top:10px"><label>${esc(tr('photos'))} — ${photos.length}</label>
        <div class="photo-grid" id="hallPhotoGrid">
          ${photos.length ? photos.map((p) => `
            <div class="photo-cell">
              <div class="photo-thumb" style="background-image:url('${p}')"></div>
              <button type="button" class="btn-sm btn-subtle" data-del-photo="${esc(p)}">${esc(tr('deletePhoto'))}</button>
            </div>`).join('') : `<p class="hint">—</p>`}
        </div>
        <div class="btn-row">
          <label class="btn ghost btn-sm2" for="hallPhotoInput" style="cursor:pointer">${esc(tr('uploadPhoto'))}</label>
          <input type="file" id="hallPhotoInput" accept="image/jpeg,image/png,image/webp" hidden>
        </div>
        <p class="hint" id="photoNote"></p>
      </div>` : '';
  return `
  <div class="modal" id="hallModal">
    <div class="modal-card" role="dialog" aria-modal="true">
      <h2 style="margin-top:0">${esc(isEdit ? tr('editHallTitle') : tr('newHallTitle'))}</h2>
      <form id="hallForm" novalidate>
        <input type="hidden" id="mHallId" value="${esc(h.id || '')}">
        <div class="field"><label for="mName">${esc(tr('hallName'))}</label><input id="mName" maxlength="80" required value="${esc(lt(h.name) || '')}"></div>
        <div class="field-row" style="margin-top:10px">
          <div class="field"><label for="mWilaya">${esc(tr('wilaya'))}</label><select id="mWilaya" required>${wilayaOpts}</select></div>
          <div class="field"><label for="mCommune">${esc(tr('commune'))}</label><input id="mCommune" maxlength="60" required value="${esc(h.commune || '')}"></div>
        </div>
        <div class="field-row" style="margin-top:10px">
          <div class="field"><label for="mCapMin">${esc(tr('capacityMin'))}</label><input id="mCapMin" type="number" min="1" max="5000" required value="${esc(h.capacityMin ?? '')}"></div>
          <div class="field"><label for="mCapMax">${esc(tr('capacityMax'))}</label><input id="mCapMax" type="number" min="1" max="5000" required value="${esc(h.capacityMax ?? '')}"></div>
        </div>
        <div class="field" style="margin-top:10px"><label for="mPrice">${esc(tr('priceDzd'))}</label><input id="mPrice" type="number" min="0" step="1000" required value="${esc(h.priceDzd ?? '')}"></div>
        <div class="field" style="margin-top:10px"><label>${esc(tr('style'))}</label><div class="radio-cards">${styleBoxes}</div></div>
        <div class="field" style="margin-top:10px"><label>${esc(tr('amenities'))}</label><div class="radio-cards">${amenBoxes}</div></div>
        <div class="field" style="margin-top:10px"><label for="mDesc">${esc(tr('description'))}</label><textarea id="mDesc" maxlength="1000">${esc(lt(h.desc) || '')}</textarea></div>
        <div class="field" style="margin-top:10px"><label for="mPhone">${esc(tr('phone'))}</label><input id="mPhone" maxlength="32" value="${esc(h.phone || '')}"></div>
        ${photosHtml}
        ${isEdit ? tourSectionHtml(h) : ''}
        <p class="error" id="hallFormErr" hidden></p>
        <div class="btn-row">
          <button class="btn gold" type="submit">${esc(tr('save'))}</button>
          <button class="btn ghost" type="button" id="hallModalCancel">${esc(tr('cancel'))}</button>
        </div>
      </form>
    </div>
  </div>`;
}

function viewOwnerWorkspace(data, halls, f, ownerHalls) {
  const c = data.counts || { total: 0, pending: 0, confirmed: 0, rejected: 0 };
  const all = data.allInquiries || data.inquiries || [];
  let list = (data.inquiries || []).slice();
  const q = String(state.inquirySearch || '').trim().toLowerCase();
  if (q) {
    list = list.filter((i) => [i.reference, i.name, i.phone].some((v) => String(v || '').toLowerCase().includes(q)));
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const next = nextEventDate(all);
  const statusOpts = [`<option value="">${esc(tr('allStatuses'))}</option>`, 'pending', 'confirmed', 'rejected']
    .map((s, idx) => (idx === 0 ? s : `<option value="${s}"${f.status === s ? ' selected' : ''}>${esc(stName(s))}</option>`))
    .join('');
  const hallOpts = [`<option value="">${esc(tr('allHalls'))}</option>`]
    .concat(halls.map((h) => `<option value="${esc(h.id)}"${f.hallId === h.id ? ' selected' : ''}>${esc(lt(h.name))}</option>`))
    .join('');
  const confirmed = all.filter((i) => i.status === 'confirmed').sort((a, b) => (a.date < b.date ? -1 : 1));
  const pendingSoon = all.filter((i) => i.status === 'pending').sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 10);
  const tab = state.ownerTab || 'inquiries';
  const ownHalls = Array.isArray(ownerHalls) ? ownerHalls : state.ownerHalls || [];
  const triageHtml = `
    <div class="card"><div class="owner-filters">
      <div class="field"><label for="oSearch">${esc(tr('search'))}</label><input id="oSearch" placeholder="${esc(tr('searchInquiriesPh'))}" value="${esc(state.inquirySearch || '')}" maxlength="60"></div>
      <div class="field"><label for="oStatus">${esc(tr('filterStatus'))}</label><select id="oStatus">${statusOpts}</select></div>
      <div class="field"><label for="oHall">${esc(tr('filterHall'))}</label><select id="oHall">${hallOpts}</select></div>
      <div class="field"><label for="oDate">${esc(tr('filterDate'))}</label><input id="oDate" type="date" value="${esc(f.date || '')}"></div>
    </div></div>
    <div class="card"><h2>${esc(tr('statTotal'))} — ${list.length}</h2>
      <p class="hint">${esc(tr('quickTriage'))} : <b>${all.filter((i) => i.status === 'pending').length}</b></p>
      <p class="error" id="ownerErr" hidden></p>
      <p class="hint" id="ownerOk" hidden></p>
      ${list.length ? list.map((i) => ownerCard(i, all)).join('') : `<p class="hint">${esc(tr('noInquiries'))}</p>`}
    </div>`;
  const calHtml = `
    <div class="card"><h2>${esc(tr('upcomingEventsTitle'))} — ${confirmed.length}</h2>
      ${confirmed.length ? `<div class="timeline">${confirmed.map((i) => `
        <div class="event-row">
          <span class="date-badge" dir="ltr">${esc(i.date)}</span>
          <div><b>${esc(lt(i.hallName))}</b><br><span class="hint">${esc(i.name)} · <span dir="ltr">${esc(i.phone)}</span> · ${esc(String(i.guests))} ${esc(tr('guests'))}</span>${i.ownerNote ? `<br><span class="hint">“${esc(i.ownerNote)}”</span>` : ''}</div>
          <span class="inq-ref" dir="ltr">${esc(i.reference)}</span>
        </div>`).join('')}</div>` : `<p class="hint">${esc(tr('noUpcomingEvents'))}</p>`}
    </div>
    <div class="card"><h2>${esc(tr('pendingSoonTitle'))}</h2>
      ${pendingSoon.length ? pendingSoon.map((i) => `<div class="day-row"><span dir="ltr"><b>${esc(i.reference)}</b></span>${stPill(i.status)}<span><span dir="ltr">${esc(i.date)}</span> · ${esc(lt(i.hallName))} · ${esc(String(i.guests))}</span></div>`).join('') : `<p class="hint">${esc(tr('noPendingSoon'))}</p>`}
    </div>`;
  const hallsHtml = `
    <div class="card">
      <div class="owner-topbar" style="margin-bottom:10px">
        <h2 style="margin:0">${esc(tr('myHallsTitle'))} — ${ownHalls.length}</h2>
        <button type="button" class="btn gold btn-sm2" id="btnAddHall">${esc(tr('addHall'))}</button>
      </div>
      <p class="error" id="hallsErr" hidden></p>
      <p class="hint" id="hallsOk" hidden></p>
      ${ownHalls.length ? ownHalls.map(ownerHallCard).join('') : `<p class="hint">${esc(tr('noHalls'))}</p>`}
    </div>
    <div id="hallModalRoot"></div>
    <div id="advisorModalRoot"></div>
    <div id="tourPreviewRoot"></div>`;
  const bodyHtml = tab === 'calendar' ? calHtml : tab === 'halls' ? hallsHtml : triageHtml;
  return `
  <div class="owner-topbar">
    <div>
      <h1 style="margin:0">${esc(tr('ownerPortalTitle'))}</h1>
      <p class="hint" style="margin:4px 0 0"><span class="owner-badge">${esc(tr('ownerBadge'))}</span> <span dir="ltr">${esc(state.user.email || '')}</span> · <span class="aibadge demo">${esc(tr('demo'))}</span></p>
    </div>
    <button type="button" class="btn-sm btn-subtle" data-action="logout">${esc(tr('navSignOut'))}</button>
  </div>
  <div class="stats stats-5">
    <div class="stat"><b>${c.total}</b><span>${esc(tr('statTotal'))}</span></div>
    <div class="stat"><b>${c.pending}</b><span>${esc(tr('statPending'))}</span></div>
    <div class="stat"><b>${c.confirmed}</b><span>${esc(tr('statConfirmed'))}</span></div>
    <div class="stat"><b>${c.rejected}</b><span>${esc(tr('statRejected'))}</span></div>
    <div class="stat"><b class="next-date" dir="ltr">${esc(next || tr('noNextEvent'))}</b><span>${esc(tr('nextEvent'))}</span></div>
  </div>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" class="tab${tab === 'inquiries' ? ' on' : ''}" data-otab="inquiries">${esc(tr('tabInquiries'))}</button>
    <button type="button" role="tab" class="tab${tab === 'calendar' ? ' on' : ''}" data-otab="calendar">${esc(tr('tabCalendar'))}</button>
    <button type="button" role="tab" id="tabHalls" class="tab${tab === 'halls' ? ' on' : ''}" data-otab="halls">${esc(tr('tabHalls'))}</button>
  </div>
  ${bodyHtml}`;
}

/* ---------------- actions ---------------- */
// Task 07: AI backfill tracking. Remembers exactly which search fields the last
// AI run wrote, so a new prompt (or "Clear AI criteria") drops only AI-provided
// values and never touches manual user filters. A field the user edited after
// the AI fill counts as manual and is kept.
const AI_FILL_SELECTORS = {
  wilaya: '#fWilaya',
  commune: '#fCommune',
  date: '#fDate',
  guests: '#fGuests',
  budget: '#fBudget',
  style: '#fStyle',
};

function clearAiBackfill() {
  const filled = state.aiFilled || {};
  Object.entries(AI_FILL_SELECTORS).forEach(([key, sel]) => {
    if (filled[key] === undefined) return;
    const el = $(sel);
    if (el && String(el.value || '') === String(filled[key])) el.value = '';
  });
  if (Array.isArray(filled.amenities) && filled.amenities.length) {
    $$('input[name="amenities"]', $('#searchForm') || document).forEach((cb) => {
      if (filled.amenities.includes(cb.value) && cb.checked) cb.checked = false;
    });
  }
  state.aiFilled = {};
}

function clearAiCriteria() {
  if (state.ranking) state.ranking.extractedCriteria = {};
  clearAiBackfill();
  const budgetEl = $('#fBudget');
  state.activeBudget = toBudgetInt(budgetEl ? budgetEl.value : null);
  renderResults(state.ranking && state.ranking.note ? state.ranking.note : null);
}

// Task 07: after AI results render, keep the results section visible and move
// programmatic focus to the results heading for screen-reader users.
function focusResultsHeading() {
  const box = $('#results');
  const titleEl = $('#resultsTitle') || (box ? box.querySelector('h2') : null);
  if (!titleEl) return;
  if (!titleEl.hasAttribute('tabindex')) titleEl.setAttribute('tabindex', '-1');
  if (box && typeof box.scrollIntoView === 'function') {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
  if (typeof titleEl.focus === 'function') {
    try {
      titleEl.focus({ preventScroll: true });
    } catch {
      titleEl.focus();
    }
  }
}

function collectCriteria() {
  const f = $('#searchForm');
  if (!f) return {};
  const fd = new FormData(f);
  const q = {};
  const wilaya = String(fd.get('wilaya') || '').trim();
  const commune = String(fd.get('commune') || '').trim();
  const date = String(fd.get('date') || '').trim();
  const guests = String(fd.get('guests') || '').trim();
  const budget = String(fd.get('budget') || '').trim();
  const style = String(fd.get('style') || '').trim();
  if (wilaya) q.wilaya = wilaya;
  if (commune) q.commune = commune;
  if (date) q.date = date;
  if (guests) q.guests = Number(guests);
  if (budget) q.budget = Number(budget);
  if (style) q.style = style;
  const amenities = $$('input[name="amenities"]:checked', f).map((cb) => cb.value);
  if (amenities.length) q.amenities = amenities;
  return q;
}

async function doSearch(withRank) {
  const box = $('#results');
  if (withRank) {
    // Task 07: a new AI query never accumulates criteria back-filled by previous
    // AI runs — drop those first so only manual filters + the fresh prompt go out.
    state.ranking = null;
    clearAiBackfill();
    if (box) box.innerHTML = `<div class="card slim" role="status" aria-live="polite"><p><span class="spinner"></span> ${esc(tr('aiWorking'))}</p></div>`;
    const resultsEl = $('#results');
    if (resultsEl && typeof resultsEl.scrollIntoView === 'function') {
      const prefersReducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
      resultsEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  } else if (box) {
    box.innerHTML = `<div class="card slim"><p><span class="spinner"></span> ${esc(tr('loading'))}</p></div>`;
  }
  const promptEl = $('#fPrompt');
  const prompt = promptEl ? String(promptEl.value || '').trim().slice(0, 600) : '';
  const q = collectCriteria();
  state.criteria = q;
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) {
      if (v.length) params.set(k, v.join(','));
      return;
    }
    params.set(k, String(v));
  });
  try {
    const data = await apiGet(`/api/halls/search?${params.toString()}`);
    state.results = data.halls || [];
    if (withRank) {
      // Loading card was already set before the request; keep it visible while ranking.
      const rank = await apiPost('/api/ai/rank', { prompt, criteria: q, lang: state.lang });
      rank.promptUsed = prompt.length > 0;
      state.ranking = rank;
      if (Array.isArray(rank.halls)) state.results = rank.halls;
      state.criteria = rank.extractedCriteria || q;
      const ex = rank.extractedCriteria || {};
      state.activeBudget = toBudgetInt(ex.budget);
      // Back-fill empty fields and remember exactly what the AI wrote.
      const filled = {};
      const fill = (sel, key, val) => {
        if (val === undefined || val === null || val === '') return;
        const el = $(sel);
        if (el && !String(el.value || '').trim()) {
          el.value = String(val);
          filled[key] = String(val);
        }
      };
      fill('#fWilaya', 'wilaya', ex.wilaya);
      fill('#fCommune', 'commune', ex.commune);
      fill('#fDate', 'date', ex.date);
      fill('#fGuests', 'guests', ex.guests);
      fill('#fBudget', 'budget', ex.budget);
      fill('#fStyle', 'style', ex.style);
      if (Array.isArray(ex.amenities)) {
        const newly = [];
        $$('input[name="amenities"]', $('#searchForm') || document).forEach((cb) => {
          if (ex.amenities.includes(cb.value) && !cb.checked) {
            cb.checked = true;
            newly.push(cb.value);
          }
        });
        if (newly.length) filled.amenities = newly;
      }
      state.aiFilled = filled;
      setBadge(rank.mode);
      renderResults(rank.note || null);
      focusResultsHeading();
    } else {
      state.ranking = null;
      state.activeBudget = toBudgetInt(q.budget);
      renderResults(null);
    }
  } catch {
    if (box) box.innerHTML = `<div class="card slim"><p class="error">${esc(tr('error'))}</p></div>`;
  }
}

/* studio: image + segmentation */
function drawStudio() {
  const cv = $('#cv');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#1a1c1a';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const img = state.studio.img;
  if (!img) {
    ctx.fillStyle = '#9fb3a8';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(tr('needPhoto'), cv.width / 2, cv.height / 2);
    return;
  }
  const scale = Math.min(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const ox = (cv.width - w) / 2;
  const oy = (cv.height - h) / 2;
  ctx.drawImage(img, ox, oy, w, h);
  const regs = state.studio.regions || [];
  ctx.lineWidth = 2;
  ctx.font = '13px system-ui';
  const legend = [];
  regs.forEach((r) => {
    const color = SEG_COLORS[r.label] || SEG_COLORS.zone;
    const x = ox + r.box.x * w;
    const y = oy + r.box.y * h;
    const bw = r.box.w * w;
    const bh = r.box.h * h;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = color;
    const label = `${r.labelLocal || r.label} ${Math.round((r.confidence || 0) * 100)}%`;
    const tw = ctx.measureText(label).width + 12;
    ctx.fillRect(x, Math.max(0, y - 20), tw, 20);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 6, Math.max(14, y - 5));
    legend.push(`<li><span class="swatch" style="background:${color}"></span>${esc(r.labelLocal || r.label)} — ${Math.round((r.confidence || 0) * 100)}%</li>`);
  });
  const lg = $('#legend');
  if (lg) lg.innerHTML = legend.join('');
}

function downscaleToBase64(img, maxSide = 1280) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.82);
  return url.split(',')[1];
}

function bindStudio() {
  drawStudio();
  const file = $('#fileUp');
  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 6 * 1024 * 1024) {
      $('#segNote').textContent = tr('error');
      return;
    }
    const img = new Image();
    img.onload = () => {
      state.studio.img = img;
      state.studio.regions = null;
      URL.revokeObjectURL(img.src);
      drawStudio();
    };
    img.src = URL.createObjectURL(f);
  });
  $('#btnSeg').addEventListener('click', async () => {
    if (!state.studio.img) {
      $('#segNote').textContent = tr('needPhoto');
      return;
    }
    $('#segNote').innerHTML = `<span class="spinner"></span> ${esc(tr('aiWorking'))}`;
    try {
      const b64 = downscaleToBase64(state.studio.img);
      const data = await apiPost('/api/ai/segment', { imageBase64: b64, mimeType: 'image/jpeg', lang: state.lang });
      state.studio.regions = data.regions || [];
      state.studio.segMode = data.mode;
      setBadge(data.mode);
      $('#segNote').innerHTML = `${modeTag(data.mode)} ${data.regions ? data.regions.length : 0} · ${esc(data.note || '')}`;
      drawStudio();
    } catch {
      $('#segNote').textContent = tr('error');
    }
  });
  $('#btnDeco').addEventListener('click', async () => {
    $('#decoNote').innerHTML = `<span class="spinner"></span> ${esc(tr('aiWorking'))}`;
    const style = ($('input[name="style"]:checked') || {}).value || 'moderne';
    const palette = ($('input[name="palette"]:checked') || {}).value || 'gold';
    const notes = ($('#decoNotes') || {}).value || '';
    try {
      const data = await apiPost('/api/ai/decorate', { style, palette, notes, lang: state.lang });
      state.studio.concepts = data.concepts || [];
      state.studio.decoMode = data.mode;
      setBadge(data.mode);
      $('#decoNote').innerHTML = `${modeTag(data.mode)} ${esc(data.note || '')}`;
      $('#concepts').innerHTML = state.studio.concepts
        .map(
          (c) => `
        <div class="concept">
          <img src="${c.imageDataUrl}" alt="${esc(c.title)}">
          <h3 style="margin-top:8px">${esc(c.title)} ${modeTag(c.imageMode)}</h3>
          <p class="hint">${esc(c.description)}</p>
          <div class="palette-row">${(c.palette || []).map((p) => `<span style="background:${esc(p)}"></span>`).join('')}</div>
          <p><b>${esc(tr('tips'))} :</b></p>
          <ul class="hint">${(c.tips || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>`
        )
        .join('');
    } catch {
      $('#decoNote').textContent = tr('error');
    }
  });
}

/* auth bindings */
function bindLogin() {
  const form = $('#loginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginErr');
    err.hidden = true;
    const btn = $('button[type="submit"]', form);
    if (btn) btn.disabled = true;
    try {
      const data = await apiPost('/api/auth/login', { email: $('#lEmail').value, password: $('#lPass').value });
      state.user = data.user;
      renderNavAuth();
      syncAdminNav();
      const dest = state.user && state.user.role === 'super_admin' ? '#/admin' : state.user && state.user.role === 'owner' ? '#/owner' : '#/account';
      if (location.hash === dest) route();
      else location.hash = dest;
    } catch (ex) {
      err.textContent = ex && ex.code === 'invalid_credentials' ? tr('errInvalidCredentials') : tr('error');
      err.hidden = false;
      if (btn) btn.disabled = false;
    }
  });
}

function strongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

function bindRegister() {
  const form = $('#regForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#regErr');
    err.hidden = true;
    const fullName = $('#rName').value.trim();
    const email = $('#rEmail').value.trim();
    const password = $('#rPass').value;
    const confirmPassword = $('#rPass2').value;
    if (fullName.length < 2) {
      err.textContent = tr('errInvalidName');
      err.hidden = false;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.textContent = tr('errInvalidEmail');
      err.hidden = false;
      return;
    }
    if (!strongPassword(password)) {
      err.textContent = tr('errWeakPassword');
      err.hidden = false;
      return;
    }
    if (password !== confirmPassword) {
      err.textContent = tr('errPasswordMismatch');
      err.hidden = false;
      return;
    }
    const btn = $('button[type="submit"]', form);
    if (btn) btn.disabled = true;
    try {
      const data = await apiPost('/api/auth/register', { fullName, email, password, confirmPassword });
      state.user = data.user;
      renderNavAuth();
      syncAdminNav();
      if (location.hash === '#/account') route();
      else location.hash = '#/account';
    } catch (ex) {
      if (ex && ex.code === 'email_already_registered') err.textContent = tr('errEmailTaken');
      else if (ex && ex.code === 'password_mismatch') err.textContent = tr('errPasswordMismatch');
      else if (ex && (ex.code === 'invalid_password' || ex.code === 'weak_password')) err.textContent = tr('errWeakPassword');
      else if (ex && ex.code === 'invalid_email') err.textContent = tr('errInvalidEmail');
      else err.textContent = tr('error');
      err.hidden = false;
      if (btn) btn.disabled = false;
    }
  });
}

function bindOwnerRegister() {
  const form = $('#ownerRegForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#ownerRegErr');
    err.hidden = true;
    const fullName = $('#orName').value.trim();
    const email = $('#orEmail').value.trim();
    const phone = $('#orPhone').value.trim();
    const businessName = $('#orBusiness').value.trim();
    const wilaya = $('#orWilaya').value;
    const commune = $('#orCommune').value.trim();
    const businessDescription = $('#orDesc').value.trim();
    const password = $('#orPass').value;
    const confirmPassword = $('#orPass2').value;
    const fail = (msg) => { err.textContent = msg; err.hidden = false; };
    if (fullName.length < 2) return fail(tr('errInvalidName'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(tr('errInvalidEmail'));
    if (!/^[+0-9][0-9 .()-]{5,19}$/.test(phone)) return fail(tr('errInvalidPhone'));
    if (businessName.length < 2) return fail(tr('errInvalidBusiness'));
    if (!/^\d{2}$/.test(wilaya || '')) return fail(tr('errInvalidWilaya'));
    if (!commune) return fail(tr('errInvalidCommune'));
    if (!businessDescription) return fail(tr('errInvalidDesc'));
    if (!strongPassword(password)) return fail(tr('errWeakPassword'));
    if (password !== confirmPassword) return fail(tr('errPasswordMismatch'));
    const btn = $('button[type="submit"]', form);
    if (btn) btn.disabled = true;
    try {
      const data = await apiPost('/api/auth/owner-register', {
        fullName, email, password, confirmPassword, phone, businessName, wilaya, commune, businessDescription,
      });
      state.user = data.user;
      renderNavAuth();
      syncAdminNav();
      if (location.hash === '#/owner') route();
      else location.hash = '#/owner';
    } catch (ex) {
      if (ex && ex.code === 'email_already_registered') fail(tr('errEmailTaken'));
      else if (ex && ex.code === 'password_mismatch') fail(tr('errPasswordMismatch'));
      else if (ex && (ex.code === 'invalid_password' || ex.code === 'weak_password')) fail(tr('errWeakPassword'));
      else if (ex && ex.code === 'invalid_email') fail(tr('errInvalidEmail'));
      else if (ex && ex.code === 'invalid_phone') fail(tr('errInvalidPhone'));
      else if (ex && ex.code === 'invalid_business_name') fail(tr('errInvalidBusiness'));
      else if (ex && ex.code === 'invalid_wilaya') fail(tr('errInvalidWilaya'));
      else if (ex && ex.code === 'invalid_commune') fail(tr('errInvalidCommune'));
      else if (ex && ex.code === 'invalid_business_description') fail(tr('errInvalidDesc'));
      else fail(tr('error'));
      if (btn) btn.disabled = false;
    }
  });
}

function bindAdminLogin() {
  const form = $('#adminLoginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#adminLoginErr');
    err.hidden = true;
    const btn = $('button[type="submit"]', form);
    if (btn) btn.disabled = true;
    try {
      const data = await apiPost('/api/auth/login', { email: $('#aEmail').value, password: $('#aPass').value });
      if (!data.user || data.user.role !== 'super_admin') {
        try { await apiPost('/api/auth/logout', {}); } catch { /* ignore */ }
        state.user = null;
        renderNavAuth();
        syncAdminNav();
        err.textContent = tr('adminAccessDenied');
        err.hidden = false;
        if (btn) btn.disabled = false;
        return;
      }
      state.user = data.user;
      renderNavAuth();
      syncAdminNav();
      route();
    } catch (ex) {
      err.textContent = ex && ex.code === 'invalid_credentials' ? tr('errInvalidCredentials') : tr('error');
      err.hidden = false;
      if (btn) btn.disabled = false;
    }
  });
}

function bindAdmin() {
  $$('[data-admin-status]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!window.confirm(tr('confirmStatusChange'))) return;
      b.disabled = true;
      try {
        await apiPost(`/api/admin/owners/${encodeURIComponent(b.dataset.adminId)}/status`, { status: b.dataset.adminStatus });
        route();
      } catch {
        const err = $('#adminErr');
        if (err) {
          err.textContent = tr('error');
          err.hidden = false;
        }
        b.disabled = false;
      }
    })
  );
}

function bindCustomerAccount(list) {
  $$('[data-details]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const ref = btn.dataset.details;
      const panel = document.getElementById(`det-${ref}`);
      const modal = $('#acctModal');
      const body = $('#acctModalBody');
      const inq = (list || []).find((x) => x.reference === ref);
      if (modal && body && inq) {
        body.innerHTML = `
          <div class="inq-head"><span class="inq-ref" dir="ltr">${esc(inq.reference)}</span>${stPill(inq.status)}</div>
          <h3>${esc(lt(inq.hallName))}</h3>
          <p><span dir="ltr">${esc(inq.date)}</span> · ${esc(String(inq.guests))} ${esc(tr('guests'))}</p>
          <p><b>${esc(tr('yourMessage'))}</b></p>
          <p class="hint">${inq.message ? esc(inq.message) : '—'}</p>
          <p><b>${esc(tr('ownerNoteLabel'))}</b></p>
          <p class="hint">${inq.ownerNote ? esc(inq.ownerNote) : esc(tr('noNoteYet'))}</p>
          ${inq.decidedAt ? `<p class="hint">${esc(tr('decidedOn'))} : <span dir="ltr">${esc(String(inq.decidedAt).slice(0, 10))}</span></p>` : ''}`;
        modal.hidden = false;
        const close = $('#acctModalClose');
        if (close) close.focus();
      } else if (panel) {
        panel.hidden = !panel.hidden;
      }
    })
  );
  const modal = $('#acctModal');
  const close = $('#acctModalClose');
  if (close && modal) {
    close.addEventListener('click', () => { modal.hidden = true; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
    document.addEventListener('keydown', function escClose(e) {
      if (e.key === 'Escape' && modal && !modal.hidden) modal.hidden = true;
    });
  }
}

function bindOwnerLogin() {
  const form = $('#ownerLoginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#ownerLoginErr');
    err.hidden = true;
    const btn = $('button[type="submit"]', form);
    if (btn) btn.disabled = true;
    try {
      const data = await apiPost('/api/auth/login', { email: $('#oEmail').value, password: $('#oPass').value });
      if (!data.user || data.user.role !== 'owner') {
        try { await apiPost('/api/auth/logout', {}); } catch { /* ignore */ }
        state.user = null;
        renderNavAuth();
        err.textContent = tr('ownerAccessDenied');
        err.hidden = false;
        if (btn) btn.disabled = false;
        return;
      }
      state.user = data.user;
      renderNavAuth();
      route();
    } catch (ex) {
      err.textContent = ex && ex.code === 'invalid_credentials' ? tr('errInvalidCredentials') : tr('error');
      err.hidden = false;
      if (btn) btn.disabled = false;
    }
  });
}

/* owner halls: modal + gallery manager */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function openHallModal(hall) {
  const root = $('#hallModalRoot');
  if (!root) return;
  root.innerHTML = hallModalHtml(hall || null);
  const modal = $('#hallModal');
  const cancel = $('#hallModalCancel');
  if (cancel) cancel.addEventListener('click', () => { root.innerHTML = ''; });
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) root.innerHTML = ''; });
  const form = $('#hallForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#hallFormErr');
      err.hidden = true;
      const id = $('#mHallId').value;
      const payload = {
        name: $('#mName').value,
        wilaya: $('#mWilaya').value,
        commune: $('#mCommune').value,
        capacityMin: Number($('#mCapMin').value),
        capacityMax: Number($('#mCapMax').value),
        priceDzd: Number($('#mPrice').value),
        styles: $$('input[name="mStyles"]:checked').map((cb) => cb.value),
        amenities: $$('input[name="mAmenities"]:checked').map((cb) => cb.value),
        desc: $('#mDesc').value,
        phone: $('#mPhone').value,
      };
      try {
        if (id) {
          await apiPut(`/api/owner/halls/${encodeURIComponent(id)}`, payload);
        } else {
          await apiPost('/api/owner/halls', payload);
        }
        root.innerHTML = '';
        route();
      } catch (ex) {
        err.textContent = tr('error');
        err.hidden = false;
      }
    });
  }
  const photoInput = $('#hallPhotoInput');
  if (photoInput && hall && hall.id) {
    photoInput.addEventListener('change', async () => {
      const f = photoInput.files && photoInput.files[0];
      if (!f) return;
      const note = $('#photoNote');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) {
        if (note) note.textContent = tr('error');
        return;
      }
      try {
        const imageBase64 = await fileToBase64(f);
        const data = await apiPost(`/api/owner/halls/${encodeURIComponent(hall.id)}/photos`, {
          imageBase64,
          mimeType: f.type,
        });
        hall.photos = data.photos || [];
        const idx = state.ownerHalls.findIndex((x) => x.id === hall.id);
        if (idx >= 0) state.ownerHalls[idx] = { ...state.ownerHalls[idx], photos: hall.photos };
        openHallModal(hall);
      } catch {
        if (note) note.textContent = tr('error');
      }
    });
  }
  $$('[data-del-photo]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!hall || !hall.id) return;
      const photoUrl = btn.dataset.delPhoto;
      btn.disabled = true;
      try {
        const data = await apiDelete(`/api/owner/halls/${encodeURIComponent(hall.id)}/photos`, { photoUrl });
        hall.photos = data.photos || [];
        const idx = state.ownerHalls.findIndex((x) => x.id === hall.id);
        if (idx >= 0) state.ownerHalls[idx] = { ...state.ownerHalls[idx], photos: hall.photos };
        openHallModal(hall);
        route();
      } catch {
        btn.disabled = false;
      }
    })
  );
  bindHallTourSection(hall);
}

function tourPayloadScenes(hall) {
  return (Array.isArray(hall.tourScenes) ? hall.tourScenes : []).map((s) => {
    const o = { id: s.id, panorama: s.panorama, hotSpots: Array.isArray(s.hotSpots) ? s.hotSpots : [] };
    if (typeof s.title === 'string') o.title = s.title;
    return o;
  });
}

function syncOwnerTour(hall, tourScenes, firstScene) {
  hall.tourScenes = tourScenes || [];
  if (firstScene !== undefined) hall.firstTourScene = firstScene || null;
  if (hall.firstTourScene && !hall.tourScenes.some((s) => s && s.id === hall.firstTourScene)) {
    hall.firstTourScene = hall.tourScenes.length ? hall.tourScenes[0].id : null;
  }
  const idx = state.ownerHalls.findIndex((x) => x.id === hall.id);
  if (idx >= 0) {
    state.ownerHalls[idx] = { ...state.ownerHalls[idx], tourScenes: hall.tourScenes, firstTourScene: hall.firstTourScene };
  }
}

function fmtFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function panoFileRatio(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('bad_image'));
      else resolve(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad_image'));
    };
    img.src = url;
  });
}

function bindHallTourSection(hall) {
  if (!hall || !hall.id) return;
  const note = $('#tourNote');
  const say = (msg) => { if (note) note.textContent = msg; };

  $$('[data-tour-connect]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const fromId = btn.dataset.tourConnect;
      const sel = document.getElementById(`linkSel-${fromId}`);
      const toId = sel && sel.value;
      if (!toId) return;
      const scenes = tourPayloadScenes(hall);
      const from = scenes.find((s) => s.id === fromId);
      const to = scenes.find((s) => s.id === toId);
      if (!from || !to) return;
      if (from.hotSpots.some((hp) => hp && (hp.targetSceneId || hp.sceneId) === toId)) return;
      const storedTo = hall.tourScenes.find((s) => s && s.id === toId);
      from.hotSpots = [...from.hotSpots, { pitch: 0, yaw: 0, text: tourSceneTitle(storedTo) || '', targetSceneId: toId }];
      const modal = $('#hallModal'); const scrollY = modal ? modal.scrollTop : 0;
      const modalCard = modal ? modal.querySelector('.modal-card') : null;
      const cardScrollY = modalCard ? modalCard.scrollTop : 0;
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        const data = await apiPut(`/api/owner/halls/${encodeURIComponent(hall.id)}/tour`, {
          tourScenes: scenes,
          firstScene: hall.firstTourScene || null,
        });
        syncOwnerTour(hall, data.tourScenes, data.firstScene);
        openHallModal(hall);
        const newModal = $('#hallModal'); if (newModal) newModal.scrollTop = scrollY;
        const newCard = newModal ? newModal.querySelector('.modal-card') : null;
        if (newCard) newCard.scrollTop = cardScrollY;
        const newNote = $('#tourNote');
        if (newNote) newNote.textContent = tr('tourLinkedOk');
      } catch {
        btn.innerHTML = origHtml;
        btn.disabled = false;
        say(tr('error'));
      }
    })
  );

  $$('[data-tour-unlink-from]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const fromId = btn.dataset.tourUnlinkFrom;
      const toId = btn.dataset.tourUnlinkTo;
      const scenes = tourPayloadScenes(hall);
      const from = scenes.find((s) => s.id === fromId);
      if (!from) return;
      from.hotSpots = from.hotSpots.filter((hp) => hp && (hp.targetSceneId || hp.sceneId) !== toId);
      const modal = $('#hallModal'); const scrollY = modal ? modal.scrollTop : 0;
      const modalCard = modal ? modal.querySelector('.modal-card') : null;
      const cardScrollY = modalCard ? modalCard.scrollTop : 0;
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        const data = await apiPut(`/api/owner/halls/${encodeURIComponent(hall.id)}/tour`, {
          tourScenes: scenes,
          firstScene: hall.firstTourScene || null,
        });
        syncOwnerTour(hall, data.tourScenes, data.firstScene);
        openHallModal(hall);
        const newModal = $('#hallModal'); if (newModal) newModal.scrollTop = scrollY;
        const newCard = newModal ? newModal.querySelector('.modal-card') : null;
        if (newCard) newCard.scrollTop = cardScrollY;
        const newNote = $('#tourNote');
        if (newNote) newNote.textContent = tr('tourUnlinkedOk');
      } catch {
        btn.innerHTML = origHtml;
        btn.disabled = false;
        say(tr('error'));
      }
    })
  );

  $$('[data-tour-first]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const modal = $('#hallModal'); const scrollY = modal ? modal.scrollTop : 0;
      const modalCard = modal ? modal.querySelector('.modal-card') : null;
      const cardScrollY = modalCard ? modalCard.scrollTop : 0;
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        const data = await apiPut(`/api/owner/halls/${encodeURIComponent(hall.id)}/tour`, {
          tourScenes: tourPayloadScenes(hall),
          firstScene: btn.dataset.tourFirst,
        });
        syncOwnerTour(hall, data.tourScenes, data.firstScene);
        openHallModal(hall);
        const newModal = $('#hallModal'); if (newModal) newModal.scrollTop = scrollY;
        const newCard = newModal ? newModal.querySelector('.modal-card') : null;
        if (newCard) newCard.scrollTop = cardScrollY;
        const newNote = $('#tourNote');
        if (newNote) newNote.textContent = tr('tourFirstOk');
      } catch {
        btn.innerHTML = origHtml;
        btn.disabled = false;
        say(tr('error'));
      }
    })
  );

  $$('[data-tour-del]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!window.confirm(tr('tourConfirmDelete'))) return;
      const modal = $('#hallModal'); const scrollY = modal ? modal.scrollTop : 0;
      const modalCard = modal ? modal.querySelector('.modal-card') : null;
      const cardScrollY = modalCard ? modalCard.scrollTop : 0;
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        const data = await apiDelete(`/api/owner/halls/${encodeURIComponent(hall.id)}/panoramas/${encodeURIComponent(btn.dataset.tourDel)}`);
        syncOwnerTour(hall, data.tourScenes);
        openHallModal(hall);
        const newModal = $('#hallModal'); if (newModal) newModal.scrollTop = scrollY;
        const newCard = newModal ? newModal.querySelector('.modal-card') : null;
        if (newCard) newCard.scrollTop = cardScrollY;
      } catch {
        btn.innerHTML = origHtml;
        say(tr('error'));
        btn.disabled = false;
      }
    })
  );

  // Task 07: immediate selection feedback — filename, size, ratio check.
  const panoInput = $('#tourPanoInput');
  if (panoInput) {
    panoInput.addEventListener('change', async () => {
      const wrap = $('#panoSelectedWrap');
      const info = $('#panoSelectedInfo');
      const f = panoInput.files && panoInput.files[0];
      if (!info) return;
      if (!f) {
        info.innerHTML = '';
        if (wrap) wrap.hidden = true;
        return;
      }
      if (wrap) wrap.hidden = false;
      const showInfo = (verdictHtml, cls) => {
        info.className = cls || '';
        info.innerHTML = `<span class="pano-file">${esc(f.name)} · ${esc(fmtFileSize(f.size))}</span>` + (verdictHtml || '');
      };
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        showInfo(`<span class="pano-verdict err">${esc(tr('tourTypeErr'))}</span>`, 'err');
        say(tr('tourTypeErr'));
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        showInfo(`<span class="pano-verdict err">${esc(tr('tourSizeErr'))}</span>`, 'err');
        say(tr('tourSizeErr'));
        return;
      }
      showInfo(`<span class="pano-verdict dim"><span class="spinner"></span></span>`);
      try {
        const ratio = await panoFileRatio(f);
        if (!panoInput.files || panoInput.files[0] !== f) return;
        if (ratio >= 1.85 && ratio <= 2.15) {
          showInfo(`<span class="pano-verdict ok">${esc(tr('panoRatioOk'))}</span>`, 'ok');
        } else {
          showInfo(`<span class="pano-verdict warn">${esc(tr('panoRatioWarn'))}</span>`, 'warn');
        }
      } catch {
        if (panoInput.files && panoInput.files[0] === f) {
          showInfo(`<span class="pano-verdict err">${esc(tr('error'))}</span>`, 'err');
        }
      }
    });
  }
  const clearPanoBtn = $('#btnClearPano');
  if (clearPanoBtn && panoInput) {
    clearPanoBtn.addEventListener('click', () => {
      panoInput.value = '';
      const wrap = $('#panoSelectedWrap');
      const info = $('#panoSelectedInfo');
      if (info) info.innerHTML = '';
      if (wrap) wrap.hidden = true;
      panoInput.focus();
    });
  }

  const upBtn = $('#btnUploadPano');
  if (upBtn) {
    upBtn.addEventListener('click', async () => {
      const input = $('#tourPanoInput');
      const f = input && input.files && input.files[0];
      if (!f) {
        say(tr('tourChoosePano'));
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        say(tr('tourTypeErr'));
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        say(tr('tourSizeErr'));
        return;
      }
      try {
        const ratio = await panoFileRatio(f);
        if (ratio < 1.8 || ratio > 2.2) {
          say(tr('tourRatioErr'));
          return;
        }
      } catch {
        say(tr('error'));
        return;
      }
      const modal = $('#hallModal'); const scrollY = modal ? modal.scrollTop : 0;
      const modalCard = modal ? modal.querySelector('.modal-card') : null;
      const cardScrollY = modalCard ? modalCard.scrollTop : 0;
      const origHtml = upBtn.innerHTML;
      upBtn.disabled = true;
      upBtn.innerHTML = '<span class="spinner"></span>';
      say(tr('loading'));
      try {
        const imageBase64 = await fileToBase64(f);
        const nameInput = $('#tourSceneName');
        const title = (nameInput && nameInput.value.trim()) || f.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Scene';
        const data = await apiPost(`/api/owner/halls/${encodeURIComponent(hall.id)}/panoramas`, {
          imageBase64,
          mimeType: f.type,
          title,
        });
        syncOwnerTour(hall, data.tourScenes);
        openHallModal(hall);
        const newModal = $('#hallModal'); if (newModal) newModal.scrollTop = scrollY;
        const newCard = newModal ? newModal.querySelector('.modal-card') : null;
        if (newCard) newCard.scrollTop = cardScrollY;
        const newNote = $('#tourNote');
        if (newNote) newNote.textContent = tr('tourSceneAdded');
      } catch (ex) {
        upBtn.innerHTML = origHtml;
        say(ex && ex.code === 'not_equirectangular' ? tr('tourRatioErr') : ex && ex.code === 'image_too_large' ? tr('tourSizeErr') : tr('error'));
        upBtn.disabled = false;
      }
    });
  }

  const prevBtn = $('#btnPreviewTour');
  if (prevBtn) prevBtn.addEventListener('click', () => openTourPreview(hall));
}

function openTourPreview(hall) {
  const root = $('#tourPreviewRoot');
  if (!root || !hall) return;
  const scenes = Array.isArray(hall.tourScenes) ? hall.tourScenes : [];
  root.innerHTML = `
  <div class="modal" id="tourPreviewModal">
    <div class="modal-card tour-preview-card" role="dialog" aria-modal="true">
      <h2 style="margin-top:0">${esc(tr('tourPreviewTitle'))}</h2>
      <p class="lead">${esc(lt(hall.name) || hall.id)}</p>
      <div id="tourPreviewPano"></div>
      <div class="btn-row"><button type="button" class="btn ghost" id="tourPreviewClose">${esc(tr('close'))}</button></div>
    </div>
  </div>`;
  let viewer = null;
  const close = () => {
    try {
      if (viewer && viewer.destroy) viewer.destroy();
    } catch { /* already gone */ }
    root.innerHTML = '';
  };
  const modal = $('#tourPreviewModal');
  const closeBtn = $('#tourPreviewClose');
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  const el = $('#tourPreviewPano');
  if (!window.pannellum) {
    el.innerHTML = `<p style="color:#fff;padding:20px">${esc(tr('error'))}</p>`;
    return;
  }
  viewer = mountPanoViewer(el, scenes, hall.firstTourScene);
}

function bindOwnerHalls() {
  const addBtn = $('#btnAddHall');
  if (addBtn) addBtn.addEventListener('click', () => openHallModal(null));
  $$('[data-hall-edit]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const hall = state.ownerHalls.find((h) => h.id === btn.dataset.hallEdit);
      if (hall) openHallModal(hall);
    })
  );
  $$('[data-hall-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!window.confirm(tr('confirmDeleteHall'))) return;
      btn.disabled = true;
      try {
        await apiDelete(`/api/owner/halls/${encodeURIComponent(btn.dataset.hallDelete)}`);
        route();
      } catch {
        const err = $('#hallsErr');
        if (err) {
          err.textContent = tr('error');
          err.hidden = false;
        }
        btn.disabled = false;
      }
    })
  );
  $$('[data-advisor]').forEach((btn) =>
    btn.addEventListener('click', () => openAdvisorModal(btn.dataset.advisor))
  );
}

/* Task 05: AI venue advisor modal */
function advisorModalHtml(hall) {
  const photos = galleryPhotos(hall);
  const checks = photos
    .map((p, i) => `
      <label class="advisor-check">
        <input type="checkbox" name="advPhoto" value="${esc(p)}"${i < 5 ? ' checked' : ''}>
        <span class="advisor-thumb" style="background-image:url('${p}')" aria-hidden="true"></span>
      </label>`)
    .join('');
  return `
  <div class="modal" id="advisorModal">
    <div class="modal-card advisor-card" role="dialog" aria-modal="true">
      <h2 style="margin-top:0">${esc(tr('advisorTitle'))}</h2>
      <p class="lead">${esc(lt(hall.name))} <span class="hint">(${esc(hall.id)})</span></p>
      <p class="hint">${esc(tr('advisorPickPhotos'))}</p>
      <div class="advisor-photos">${checks}</div>
      <div class="btn-row">
        <button type="button" class="btn gold" id="btnRunAdvisor">${esc(tr('analyzeWithAI'))}</button>
        <button type="button" class="btn ghost" id="advisorModalCancel">${esc(tr('cancel'))}</button>
      </div>
      <p class="error" id="advisorErr" hidden></p>
      <div id="advisorResult" style="margin-top:12px"></div>
    </div>
  </div>`;
}

function advisorReportHtml(data) {
  const r = data.report || {};
  const facts = data.facts || {};
  const section = (titleKey, items) => `
    <section class="advisor-section">
      <h3>${esc(tr(titleKey))}</h3>
      <ul>${(Array.isArray(items) ? items : []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </section>`;
  const amenCount = Array.isArray(facts.amenities) ? facts.amenities.length : 0;
  return `
    <div class="advisor-head">
      ${metaTag(data.mode)}
      <span class="chip">${esc(tr('advisorFactsTitle'))} : ${esc(String(facts.capacityMin ?? '?'))}–${esc(String(facts.capacityMax ?? '?'))} ${esc(tr('guests'))} · ${esc(tr('wilaya'))} ${esc(facts.wilaya || '—')} · ${amenCount} ${esc(tr('amenities')).toLowerCase()}</span>
    </div>
    ${data.note ? `<p class="hint">${esc(data.note)}</p>` : ''}
    ${section('advStrengths', r.strengths)}
    ${section('advGallery', r.galleryObservations)}
    ${section('advViews', r.recommendedViews)}
    ${section('advListing', r.listingImprovements)}
    ${section('advPresent', r.presentationTips)}
    ${section('advNext', r.nextActions)}
    <p class="hint advisor-disclaimer"><i>${esc(tr('advisorDisclaimer'))}</i></p>`;
}

function openAdvisorModal(hallId) {
  const hall = state.ownerHalls.find((h) => h.id === hallId);
  const root = $('#advisorModalRoot');
  if (!hall || !root) return;
  root.innerHTML = advisorModalHtml(hall);
  const modal = $('#advisorModal');
  const cancel = $('#advisorModalCancel');
  if (cancel) cancel.addEventListener('click', () => { root.innerHTML = ''; });
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) root.innerHTML = ''; });
  const runBtn = $('#btnRunAdvisor');
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const err = $('#advisorErr');
      const out = $('#advisorResult');
      err.hidden = true;
      const selectedPhotos = $$('input[name="advPhoto"]:checked').map((cb) => cb.value).slice(0, 5);
      if (!selectedPhotos.length) {
        err.textContent = tr('advisorNeedPhotos');
        err.hidden = false;
        return;
      }
      runBtn.disabled = true;
      out.innerHTML = `<p><span class="spinner"></span> ${esc(tr('advisorAnalyzing'))}</p>`;
      try {
        const data = await apiPost(`/api/owner/halls/${encodeURIComponent(hall.id)}/advisor`, {
          selectedPhotos,
          lang: state.lang,
        });
        out.innerHTML = advisorReportHtml(data);
      } catch {
        out.innerHTML = '';
        err.textContent = tr('error');
        err.hidden = false;
      } finally {
        runBtn.disabled = false;
      }
    });
  }
}

/* owner dashboard */
function bindOwner() {
  $$('[data-otab]').forEach((t) =>
    t.addEventListener('click', () => {
      state.ownerTab = t.dataset.otab;
      route();
    })
  );
  bindOwnerHalls();
  const apply = () => {
    const s = $('#oStatus');
    const h = $('#oHall');
    const d = $('#oDate');
    state.ownerFilter = {
      status: s ? s.value : state.ownerFilter.status,
      hallId: h ? h.value : state.ownerFilter.hallId,
      date: d ? d.value : state.ownerFilter.date,
    };
    route();
  };
  const sEl = $('#oStatus');
  const hEl = $('#oHall');
  const dEl = $('#oDate');
  if (sEl) sEl.addEventListener('change', apply);
  if (hEl) hEl.addEventListener('change', apply);
  if (dEl) dEl.addEventListener('change', apply);
  const searchEl = $('#oSearch');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      state.inquirySearch = searchEl.value;
      const q = searchEl.value.trim().toLowerCase();
      $$('.card .inq').forEach((card) => {
        card.hidden = !!q && !card.textContent.toLowerCase().includes(q);
      });
    });
  }
  $$('[data-decide]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const ref = btn.dataset.ref;
      const decision = btn.dataset.decide;
      if (!window.confirm(decision === 'accept' ? tr('confirmAccept') : tr('confirmReject'))) return;
      const noteEl = document.querySelector(`[data-note="${ref}"]`);
      const note = noteEl ? noteEl.value : '';
      btn.disabled = true;
      try {
        await apiPost(`/api/owner/inquiries/${encodeURIComponent(ref)}/decision`, { decision, note });
        route();
      } catch (ex) {
        const err = $('#ownerErr');
        err.textContent = ex && ex.code === 'date_already_booked' ? tr('conflictErr') : tr('error');
        err.hidden = false;
        btn.disabled = false;
      }
    })
  );
}

/* client tracking */
async function lookupRef(ref, target) {
  const box = $(target);
  const code = String(ref || '').trim().toUpperCase();
  if (!code) return;
  box.innerHTML = `<p><span class="spinner"></span> ${esc(tr('loading'))}</p>`;
  try {
    const data = await apiGet(`/api/inquiries/${encodeURIComponent(code)}`);
    box.innerHTML = trackResultHtml(data.inquiry);
  } catch {
    box.innerHTML = `<p class="error">${esc(tr('notFound'))}</p>`;
  }
}

function bindTrack(initialRef) {
  $('#trackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#trackRef').value.trim().toUpperCase();
    if (!code) return;
    if (location.hash === `#/track/${encodeURIComponent(code)}`) {
      lookupRef(code, '#trackResult');
    } else {
      location.hash = `#/track/${encodeURIComponent(code)}`;
    }
  });
  if (initialRef) lookupRef(initialRef, '#trackResult');
}

function bindQuickChips() {
  $$('.quick-chip').forEach((chip) =>
    chip.addEventListener('click', () => {
      const target = $('#fPrompt');
      if (target) {
        target.value = tr(chip.dataset.qp);
        target.focus();
      }
    })
  );
}

/* tour (Pannellum, connected multi-scene) */
function tourScenesObject(rawScenes) {
  const scenes = {};
  for (const s of rawScenes || []) {
    if (!s || !s.id || !s.panorama) continue;
    const spots = Array.isArray(s.hotSpots) ? s.hotSpots : [];
    scenes[s.id] = {
      type: 'equirectangular',
      title: tourSceneTitle(s) || tr('tour'),
      panorama: s.panorama,
      hotSpots: spots
        .filter((hp) => hp && (hp.targetSceneId || hp.sceneId))
        .map((hp) => ({
          pitch: Number(hp.pitch) || 0,
          yaw: Number(hp.yaw) || 0,
          type: 'scene',
          text: typeof hp.text === 'string' ? hp.text : tourSceneTitle({ title: hp.text }) || '',
          sceneId: hp.targetSceneId || hp.sceneId,
        })),
    };
  }
  return scenes;
}

// Shared Pannellum mount used by the public tour and the owner preview modal.
// Every scene carries an explicit equirectangular type, cross-origin textures
// are allowed, and load failures clear the spinner with a way back.
function mountPanoViewer(el, rawScenes, firstSceneId) {
  const scenes = tourScenesObject(rawScenes);
  const ids = Object.keys(scenes);
  if (!ids.length) {
    el.innerHTML = `<p style="color:#fff;padding:20px">${esc(tr('error'))}</p>`;
    return null;
  }
  const first = firstSceneId && scenes[firstSceneId] ? firstSceneId : ids[0];
  const viewer = window.pannellum.viewer(el.id, {
    default: {
      firstScene: first,
      sceneFadeDuration: 800,
      autoLoad: true,
      type: 'equirectangular',
      crossOrigin: 'anonymous',
    },
    scenes,
  });
  let currentScene = first;
  let previousScene = first;
  try {
    viewer.on('scenechange', (next) => {
      if (typeof next === 'string' && scenes[next]) {
        previousScene = currentScene;
        currentScene = next;
      }
    });
  } catch { /* older pannellum without scenechange details */ }
  viewer.on('error', () => {
    const loadBox = el.querySelector('.pnlm-load-box');
    if (loadBox) loadBox.style.display = 'none';
    el.querySelectorAll('.pnlm-custom-error').forEach((n) => n.remove());
    const errDiv = document.createElement('div');
    errDiv.className = 'pnlm-custom-error';
    errDiv.innerHTML = `<p>${esc(tr('panoramaLoadError'))}</p><button class="btn-sm btn-subtle" id="btnPanoRetry">${esc(tr('returnToPrevious'))}</button>`;
    el.appendChild(errDiv);
    const retryBtn = errDiv.querySelector('#btnPanoRetry');
    if (retryBtn) retryBtn.addEventListener('click', () => {
      errDiv.remove();
      try {
        viewer.loadScene(scenes[previousScene] ? previousScene : ids[0]);
      } catch {
        viewer.loadScene(ids[0]);
      }
    });
  });
  return viewer;
}

function hallHasTour(hall) {
  return !!hall && Array.isArray(hall.tourScenes) && hall.tourScenes.length > 0;
}

function bindTour(hall) {
  const btn = $('#btnTour');
  if (!btn) return;
  const isDemo = !hall || !hall.id || !!HALL_PHOTOS[hall.id];
  if (!hallHasTour(hall) && !isDemo) {
    const card = btn.closest('.card');
    if (card) {
      card.innerHTML = `<h2>${esc(tr('tour'))}</h2><div class="card slim hint"><p>${esc(tr('noTourPublished'))}</p></div>`;
    }
    return;
  }
  btn.addEventListener('click', () => {
    const el = $('#pano');
    el.hidden = false;
    btn.disabled = true;
    if (!window.pannellum) {
      el.innerHTML = `<p style="color:#fff;padding:20px">${esc(tr('error'))}</p>`;
      return;
    }
    const rawScenes = hallHasTour(hall) ? hall.tourScenes : defaultTourScenes();
    mountPanoViewer(el, rawScenes, hall && hall.firstTourScene);
  });
}

function bindInquiryForm(h) {
  const form = $('#inqForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#inqErr');
    err.hidden = true;
    if (!$('#qConsent').checked) {
      err.textContent = tr('consentReq');
      err.hidden = false;
      return;
    }
    try {
      const res = await apiPost('/api/inquiries', {
        hallId: h.id,
        name: $('#qName').value,
        phone: $('#qPhone').value,
        date: $('#qDate').value,
        guests: Number($('#qGuests').value),
        message: $('#qMsg').value,
        consent: true,
        lang: state.lang,
      });
      location.hash = `#/confirmation/${res.reference}`;
    } catch (ex) {
      err.textContent = ex && ex.code === 'consent_required' ? tr('consentReq') : tr('error');
      err.hidden = false;
    }
  });
}

/* ---------------- router ---------------- */
async function route() {
  const hash = location.hash || '#/';
  const view = $('#view');
  syncAdminNav();
  const nav = hash.startsWith('#/admin') ? 'admin' : hash.startsWith('#/owner') ? 'owner' : hash.startsWith('#/studio') ? 'studio' : hash.startsWith('#/track') ? 'track' : (hash === '#/' || hash === '#' || hash === '#/search' || hash.startsWith('#/hall/') || hash.startsWith('#/inquiry/') || hash.startsWith('#/confirmation/') ? 'search' : '');
  $$('.topnav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
  window.scrollTo(0, 0);

  let m;
  if (hash === '#/' || hash === '#' || hash === '#/search') {
    view.innerHTML = viewSearch();
    $('#btnSearch').addEventListener('click', () => doSearch(false));
    $('#btnRank').addEventListener('click', () => doSearch(true));
    $('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      doSearch(false);
    });
    bindQuickChips();
    if (!state.initialLoaded) {
      state.initialLoaded = true;
      doSearch(false);
    } else if (state.results.length) {
      renderResults(state.ranking ? state.ranking.note || null : null);
    }
    return;
  }
  if ((m = hash.match(/^#\/hall\/(.+)$/))) {
    view.innerHTML = `<div class="card slim"><p><span class="spinner"></span> ${esc(tr('loading'))}</p></div>`;
    try {
      const data = await apiGet(`/api/halls/${encodeURIComponent(m[1])}`);
      view.innerHTML = viewHall(data.hall);
      bindGallery();
      bindTour(data.hall);
      bindInquiryForm(data.hall);
    } catch {
      view.innerHTML = `<div class="card slim"><p class="error">${esc(tr('error'))}</p></div>`;
    }
    return;
  }
  if ((m = hash.match(/^#\/studio(?:\/(.+))?$/))) {
    let hall = null;
    if (m[1]) {
      try {
        hall = (await apiGet(`/api/halls/${encodeURIComponent(m[1])}`)).hall;
      } catch { /* studio works without a hall */ }
    }
    view.innerHTML = viewStudio(hall);
    bindStudio();
    return;
  }
  if ((m = hash.match(/^#\/inquiry\/(.+)$/))) {
    view.innerHTML = `<div class="card slim"><p><span class="spinner"></span> ${esc(tr('loading'))}</p></div>`;
    try {
      const data = await apiGet(`/api/halls/${encodeURIComponent(m[1])}`);
      const h = data.hall;
      view.innerHTML = viewInquiry(h);
      bindInquiryForm(h);
    } catch {
      view.innerHTML = `<div class="card slim"><p class="error">${esc(tr('error'))}</p></div>`;
    }
    return;
  }
  if (hash === '#/login') {
    if (state.user) {
      location.hash = state.user.role === 'super_admin' ? '#/admin' : state.user.role === 'owner' ? '#/owner' : '#/account';
      return;
    }
    view.innerHTML = viewLogin();
    bindLogin();
    return;
  }
  if (hash === '#/register') {
    if (state.user) {
      location.hash = state.user.role === 'super_admin' ? '#/admin' : state.user.role === 'owner' ? '#/owner' : '#/account';
      return;
    }
    view.innerHTML = viewRegister();
    bindRegister();
    return;
  }
  if (hash === '#/owner/register') {
    if (state.user) {
      location.hash = state.user.role === 'super_admin' ? '#/admin' : state.user.role === 'owner' ? '#/owner' : '#/account';
      return;
    }
    view.innerHTML = viewOwnerRegister();
    bindOwnerRegister();
    return;
  }
  if (hash === '#/admin') {
    if (!state.user || state.user.role !== 'super_admin') {
      view.innerHTML = viewAdminLogin();
      bindAdminLogin();
      return;
    }
    view.innerHTML = `<div class="card slim"><p><span class="spinner"></span> ${esc(tr('loading'))}</p></div>`;
    try {
      const [metrics, owners] = await Promise.all([
        apiGet('/api/admin/metrics'),
        apiGet('/api/admin/owners'),
      ]);
      view.innerHTML = viewAdminDashboard(metrics, owners);
      bindAdmin();
    } catch (ex) {
      if (ex && ex.message && String(ex.message).includes('401')) {
        state.user = null;
        renderNavAuth();
        syncAdminNav();
        view.innerHTML = viewAdminLogin();
        bindAdminLogin();
        return;
      }
      view.innerHTML = `<div class="card slim"><p class="error">${esc(tr('error'))}</p></div>`;
    }
    return;
  }
  if (hash === '#/account') {
    if (!state.user) {
      location.hash = '#/login';
      return;
    }
    if (state.user.role === 'super_admin') {
      location.hash = '#/admin';
      return;
    }
    if (state.user.role === 'owner') {
      location.hash = '#/owner';
      return;
    }
    view.innerHTML = `<div class="card slim"><p><span class="spinner"></span> ${esc(tr('loading'))}</p></div>`;
    try {
      const data = await apiGet('/api/customer/inquiries');
      view.innerHTML = viewCustomerAccount(data);
      bindCustomerAccount(data.inquiries || []);
    } catch (ex) {
      if (ex && ex.message && String(ex.message).includes('401')) {
        state.user = null;
        renderNavAuth();
        location.hash = '#/login';
        return;
      }
      view.innerHTML = `<div class="card slim"><p class="error">${esc(tr('error'))}</p></div>`;
    }
    return;
  }
  if (hash === '#/owner') {
    if (state.user && state.user.role === 'super_admin') {
      location.hash = '#/admin';
      return;
    }
    if (!state.user || state.user.role !== 'owner') {
      if (!state.ownerConfigured) {
        try {
          const st = await apiGet('/api/auth/owner-status');
          state.ownerConfigured = !!st.configured;
        } catch { /* keep cached value */ }
      }
      if (!state.ownerConfigured) {
        view.innerHTML = viewOwnerSetup();
        return;
      }
      view.innerHTML = viewOwnerLogin();
      bindOwnerLogin();
      return;
    }
    // Task 08: refresh the account status, then gate the workspace on it.
    try {
      const me = await apiGet('/api/auth/me');
      if (me && me.authenticated && me.user) {
        state.user = me.user;
        renderNavAuth();
      }
    } catch { /* keep cached user */ }
    const ownerStatus = (state.user && state.user.status) || 'approved';
    if (ownerStatus === 'pending') {
      view.innerHTML = viewOwnerPending(state.user);
      return;
    }
    if (ownerStatus === 'suspended' || ownerStatus === 'rejected') {
      view.innerHTML = viewOwnerBlocked(state.user);
      return;
    }
    view.innerHTML = `<div class="card slim"><p><span class="spinner"></span> ${esc(tr('loading'))}</p></div>`;
    try {
      const f = state.ownerFilter;
      const params = new URLSearchParams();
      if (f.status) params.set('status', f.status);
      if (f.hallId) params.set('hallId', f.hallId);
      if (f.date) params.set('date', f.date);
      const [data, allData, halls, ownHalls] = await Promise.all([
        apiGet(`/api/owner/inquiries?${params.toString()}`),
        apiGet('/api/owner/inquiries'),
        apiGet('/api/halls/search'),
        apiGet('/api/owner/halls').catch(() => ({ halls: [] })),
      ]);
      data.allInquiries = allData.inquiries || [];
      data.counts = allData.counts || data.counts;
      state.ownerHalls = ownHalls.halls || [];
      view.innerHTML = viewOwnerWorkspace(data, halls.halls || [], f, state.ownerHalls);
      bindOwner();
    } catch (ex) {
      if (ex && ex.message && String(ex.message).includes('401')) {
        state.user = null;
        renderNavAuth();
        view.innerHTML = viewOwnerLogin();
        bindOwnerLogin();
        return;
      }
      if (ex && ex.message && String(ex.message).includes('403')) {
        try {
          const me = await apiGet('/api/auth/me');
          if (me && me.authenticated && me.user) state.user = me.user;
        } catch { /* keep cached user */ }
        route();
        return;
      }
      view.innerHTML = `<div class="card slim"><p class="error">${esc(tr('error'))}</p></div>`;
    }
    return;
  }
  if ((m = hash.match(/^#\/track(?:\/(.+))?$/))) {
    const initialRef = m[1] ? decodeURIComponent(m[1]) : '';
    view.innerHTML = viewTrack(initialRef);
    bindTrack(initialRef);
    return;
  }
  if ((m = hash.match(/^#\/confirmation\/(.+)$/))) {
    const ref = decodeURIComponent(m[1]);
    view.innerHTML = viewConfirm(ref);
    apiGet(`/api/inquiries/${encodeURIComponent(ref)}`)
      .then((data) => {
        const box = $('#confStatus');
        if (box) box.innerHTML = `${stPill(data.inquiry.status)}${data.inquiry.ownerNote ? `<p class="hint">${esc(data.inquiry.ownerNote)}</p>` : ''}`;
      })
      .catch(() => {
        const box = $('#confStatus');
        if (box) box.innerHTML = stPill('pending');
      });
    return;
  }
  location.hash = '#/';
}

/* ---------------- boot ---------------- */
async function boot() {
  applyLang();
  state.lastAiMode = 'demo';
  $$('.langsel button').forEach((b) =>
    b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      localStorage.setItem('wa-lang', state.lang);
      applyLang();
      setBadge(state.lastAiMode);
      route();
    })
  );
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-action="logout"]') : null;
    if (t) {
      e.preventDefault();
      doLogout();
    }
  });
  try {
    const [w, meta, me, ost] = await Promise.all([
      apiGet('/api/wilayas'),
      apiGet('/api/meta-status'),
      apiGet('/api/auth/me').catch(() => ({ authenticated: false })),
      apiGet('/api/auth/owner-status').catch(() => ({ configured: false })),
    ]);
    state.wilayas = w.wilayas || [];
    state.meta = meta;
    if (me && me.authenticated && me.user) state.user = me.user;
    state.ownerConfigured = !!(ost && ost.configured);
    state.lastAiMode = 'demo';
    setBadge('demo');
    renderNavAuth();
    syncAdminNav();
  } catch {
    setBadge('demo');
  }
  await route();
}

document.addEventListener('DOMContentLoaded', boot);
