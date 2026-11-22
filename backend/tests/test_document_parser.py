import csv
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from docx import Document as DocxDocument
from pypdf import PdfWriter

from app.services.ingestion.parser import DocumentParsingError, extract_text


def test_extracts_text_and_markdown(tmp_path):
    for extension in (".txt", ".md"):
        source = tmp_path / f"sample{extension}"
        source.write_text("EnterpriseIQ document", encoding="utf-8")

        assert extract_text(source) == "EnterpriseIQ document"


def test_extracts_csv_rows(tmp_path):
    source = tmp_path / "sample.csv"
    with source.open("w", encoding="utf-8", newline="") as stream:
        csv.writer(stream).writerows([["name", "value"], ["answer", "42"]])

    assert extract_text(source) == "name\tvalue\nanswer\t42"


def test_extracts_docx_paragraphs_and_tables(tmp_path):
    source = tmp_path / "sample.docx"
    document = DocxDocument()
    document.add_paragraph("Document heading")
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "key"
    table.rows[0].cells[1].text = "value"
    document.save(source)

    assert extract_text(source) == "Document heading\nkey\tvalue"


def test_reads_valid_pdf(tmp_path):
    source = tmp_path / "sample.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    with source.open("wb") as stream:
        writer.write(stream)

    assert extract_text(source) == ""


def test_rejects_corrupted_and_unsupported_documents(tmp_path):
    corrupted_pdf = tmp_path / "broken.pdf"
    corrupted_pdf.write_bytes(b"not a PDF")
    corrupted_docx = tmp_path / "broken.docx"
    with ZipFile(corrupted_docx, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="word/document.xml"/>'
            "</Relationships>",
        )
        archive.writestr("word/document.xml", "<not valid xml")
    unsupported = tmp_path / "sample.exe"
    unsupported.write_bytes(b"data")

    with pytest.raises(DocumentParsingError, match="unreadable or corrupted"):
        extract_text(corrupted_pdf)
    with pytest.raises(DocumentParsingError, match="unreadable or corrupted"):
        extract_text(corrupted_docx)
    with pytest.raises(DocumentParsingError, match="Unsupported document type"):
        extract_text(unsupported)
