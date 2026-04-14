"""PDF text extraction tools."""

from __future__ import annotations

import io
import tempfile

from base.platform_api import PlatformAPIClient
from base.tools.schema import tool

MAX_TEXT_LENGTH = 50_000
_client: PlatformAPIClient | None = None


def _get_client() -> PlatformAPIClient:
    global _client
    if _client is None:
        _client = PlatformAPIClient()
    return _client


@tool(description="读取已上传的PDF文件，提取文本和表格内容")
def read_uploaded_pdf(file_id: str) -> str:
    """file_id: 已上传文件的ID"""
    try:
        import pdfplumber
    except ImportError:
        return "[PDF Error] pdfplumber 未安装，请执行: pip install pdfplumber"

    try:
        pdf_bytes = _get_client().get_bytes(f"/files/{file_id}")
    except Exception as e:
        return f"[PDF Error] 下载文件失败: {e}"

    try:
        pages_text: list[str] = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                parts: list[str] = []

                text = page.extract_text()
                if text and text.strip():
                    parts.append(text.strip())

                tables = page.extract_tables()
                for table in tables:
                    if not table:
                        continue
                    header = table[0]
                    md_lines = ["| " + " | ".join(str(c or "") for c in header) + " |"]
                    md_lines.append("| " + " | ".join("---" for _ in header) + " |")
                    for row in table[1:]:
                        md_lines.append("| " + " | ".join(str(c or "") for c in row) + " |")
                    parts.append("\n".join(md_lines))

                if parts:
                    pages_text.append(f"=== 第{i}页 ===\n" + "\n\n".join(parts))

        if not pages_text:
            return "[PDF] 未能从PDF中提取到文本内容。该文件可能是扫描版/图片PDF，当前不支持OCR。"

        full_text = "\n\n".join(pages_text)
        if len(full_text) > MAX_TEXT_LENGTH:
            full_text = full_text[:MAX_TEXT_LENGTH] + f"\n\n[已截断，原文共{len(full_text)}字符，仅显示前{MAX_TEXT_LENGTH}字符]"
        return full_text

    except Exception as e:
        return f"[PDF Error] 解析PDF失败: {e}"
