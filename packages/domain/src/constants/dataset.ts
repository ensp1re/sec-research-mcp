export const RETENTION_MODE = {
  SCRATCH: "scratch",
  PINNED: "pinned",
} as const;

export const LOCATOR_KIND = {
  XBRL_CONTEXT: "xbrl_context",
  ELEMENT_ID: "element_id",
  TEXT_OFFSET: "text_offset",
  TABLE_ROW: "table_row",
  PDF_PAGE_BBOX: "pdf_page_bbox",
} as const;
