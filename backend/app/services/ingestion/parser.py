import csv
from pathlib import Path
from zipfile import BadZipFile

from docx import Document as DocxDocument
from docx.opc.exceptions import PackageNotFoundError
from lxml.etree import XMLSyntaxError
from pypdf import PdfReader
from pypdf.errors import PdfReadError


SUPPORTED_EXTENSIONS = frozenset({".pdf", ".docx", ".txt", ".md", ".csv"})


class DocumentParsingError(ValueError):
    """Raised when a document cannot be read or parsed."""


def extract_text(file_path: str | Path) -> str:
    path = Path(file_path)
    extension = path.suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise DocumentParsingError(f"Unsupported document type: {extension or 'unknown'}.")

    try:
        if extension == ".pdf":
            reader = PdfReader(str(path))
            if reader.is_encrypted:
                raise DocumentParsingError("Encrypted PDF files are not supported.")
            return "\n".join(
                text
                for page in reader.pages
                if (text := page.extract_text())
            )

        if extension == ".docx":
            document = DocxDocument(str(path))
            content = [paragraph.text for paragraph in document.paragraphs]
            content.extend(
                "\t".join(cell.text for cell in row.cells)
                for table in document.tables
                for row in table.rows
            )
            return "\n".join(text for text in content if text)

        if extension == ".csv":
            with path.open("r", encoding="utf-8-sig", newline="") as source:
                return "\n".join(
                    "\t".join(row) for row in csv.reader(source, strict=True)
                )

        return path.read_text(encoding="utf-8-sig")
    except DocumentParsingError:
        raise
    except (
        BadZipFile,
        csv.Error,
        KeyError,
        OSError,
        PackageNotFoundError,
        PdfReadError,
        UnicodeError,
        ValueError,
        XMLSyntaxError,
    ) as exc:
        raise DocumentParsingError(
            "The uploaded file is unreadable or corrupted."
        ) from exc
