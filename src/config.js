// @ts-check
// Fixed settings for Sales Diary. Plain values only: nothing here may depend on another file,
// because Apps Script loads all files into one global scope in no guaranteed order.

/**
 * The owner's "Mitchell Sales Meta-Data" spreadsheet (ADR-0007). Read only, never written
 * (ADR-0005). If the owner ever replaces that sheet, change this one line and push.
 */
const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';

/**
 * The Sales Diary spreadsheet, created in phase 1 (ADR-0008). Holds link codes from phase 2:
 * never share it.
 */
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';

/**
 * The web app's address (ADR-0008): the phase 1 deployment, always updated in place with
 * `clasp update-deployment`, so links already sent keep working.
 */
const WEB_APP_URL = 'https://script.google.com/macros/s/' +
  'AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec';

/** Tab names in the Meta-Data sheet. */
const META_TABS = {
  salesmen: 'Rep_Mapping',
  repTargets: 'Rep-Targets',
  regionTargets: 'Targets',
};

/** The salesmen's regions, in display order. */
const REGIONS = ['North', 'Center', 'South'];

/** The `Targets` region that means house / office sales (not tied to a salesman). */
const HOUSE_REGION = 'UNASSIGNED';
const HOUSE_REGION_LABEL = 'House / office sales';

/** Pakistan time. Used for "this month" and as the Sales Diary sheet's timezone. */
const APP_TIME_ZONE = 'Asia/Karachi';

/** Tab names in the Sales Diary sheet. */
const DIARY_TABS = {
  sites: 'Sites',
  activity: 'Activity',
  lists: 'Lists',
  links: 'Links',
};

/**
 * Header rows for the Sales Diary tabs, exactly as in docs/architecture/data-model.md.
 * Change them only together with that file.
 * @type {Object<string, string[]>}
 */
const DIARY_HEADERS = {
  Sites: [
    'site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
    'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
    'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at',
  ],
  Activity: [
    'activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
    'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup',
  ],
  Lists: ['list', 'value', 'region', 'added_by', 'active', 'sort'],
  Links: ['role', 'rep', 'token', 'active', 'issued_at'],
};

/**
 * Columns set to plain text when setup creates a tab: phone numbers keep their digits, and link
 * codes are never turned into numbers or dates.
 * @type {Object<string, string[]>}
 */
const TEXT_COLUMNS = {
  Sites: ['contact_phone'],
  Links: ['token'],
};

/**
 * Starting rows for the `Lists` tab, in display order. Setup writes a list only when the tab
 * has no rows for it, so the owner's later edits are never overwritten. After that the app
 * reads these values from the sheet, never from here.
 * `area` is deliberately absent: salesmen build that list themselves.
 * @type {Object<string, string[]>}
 */
const STARTING_LISTS = {
  product_category: [
    'Tile Adhesives',
    'Waterproofing Job',
    'Floor Hardeners',
    'Bonding Agents & Sealants',
    'Waterproofing Products',
    'Tile Grouts',
    'Structural Grouts',
    'Restoration & Repair Products',
    'Admixtures',
    'Surface Protection',
    'Mortars, Plasters & Putties',
  ],
  lost_reason: [
    'Price Too High',
    'Credit Terms',
    'Competitor Approved',
    'Site Delayed',
    'Other',
  ],
  buyer_type: [
    'Contractor / Applicator',
    'Project Owner',
    'Consultant',
    'Dealer',
  ],
};

/** Who `added_by` names for the starting `Lists` rows, and the gap between `sort` values. */
const STARTING_LISTS_ADDED_BY = 'owner';
const LIST_SORT_STEP = 10;

/** The five sales stages, in order, exactly as in the glossary. */
const STAGES = ['Visited / Lead', 'Sample / Trial', 'Rate Quoted', 'Won (Order)', 'Lost / Dead'];

/** Stage a new site starts at. */
const FIRST_STAGE = 'Visited / Lead';

/**
 * Follow-up buttons (glossary): days from today. "Pick date" sends a yyyy-MM-dd date.
 * @type {Object<string, number>}
 */
const FOLLOW_UP_DAYS = { tomorrow: 1, '3days': 3, '1week': 7 };

/** Limits on typed text, dates and Rs. values (specs 003, 004). */
const LIMITS = { siteName: 80, contactName: 60, area: 40, note: 200, followUpDays: 365, valueRs: 1000000000 };

/** Stages that need a Rs. value and Cash / Credit (spec 004, owner P4-2). */
const VALUE_STAGES = ['Rate Quoted', 'Won (Order)'];

/** Stages a site can't reach without a contact number (owner P3-4). */
const NUMBER_STAGES = ['Sample / Trial', 'Rate Quoted', 'Won (Order)'];

/** Hot Pipeline: his near-term orders (vision, spec 006). */
const HOT_STAGES = ['Sample / Trial', 'Rate Quoted'];

/**
 * Going cold (owner Q5, spec 007): a Hot Pipeline site whose last real Update was this many
 * days ago or more turns yellow on his card.
 */
const COLD_DAYS = 7;

/** Closed stages: no follow-up date (owner P4-3). */
const CLOSED_STAGES = ['Won (Order)', 'Lost / Dead'];

/** The stage that needs a lost reason. */
const LOST_STAGE = 'Lost / Dead';

/** Payment terms buttons (glossary). */
const PAYMENT_TERMS = ['Cash', 'Credit'];

/** How `Sites.products` joins categories: their names can contain commas. */
const PRODUCTS_SEPARATOR = ' | ';

/**
 * What `Activity.rep` says for a change the admin (the owner, as people see him: owner P7-7)
 * made from his screen, and the key his saves are remembered under (spec 008). Salesman codes are
 * upper case, so it can't be mistaken for one.
 */
const ADMIN_ACTOR = 'admin';

/** How the admin's note starts on the salesman's card and in the history (owner P7-4). */
const ADMIN_NOTE_PREFIX = 'Admin: ';

/** Google's name for the empty first tab of a new spreadsheet. */
const DEFAULT_FIRST_TAB = 'Sheet1';
