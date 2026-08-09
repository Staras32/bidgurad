from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"
FIXTURES.mkdir(parents=True, exist_ok=True)

FONT_PATH = Path("C:/Windows/Fonts/arial.ttf")
FONT_BOLD_PATH = Path("C:/Windows/Fonts/arialbd.ttf")


def make_text_pdf() -> None:
    target = FIXTURES / "boq-text-layer-smoke.pdf"
    pdfmetrics.registerFont(TTFont("FixtureArial", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("FixtureArialBold", str(FONT_BOLD_PATH)))
    doc = canvas.Canvas(str(target), pagesize=A4)
    _, height = A4

    doc.setFont("FixtureArialBold", 15)
    doc.drawString(48, height - 55, "TECHNINIS BOQ PARSERIO TESTAS")
    doc.setFont("FixtureArial", 9)
    doc.drawString(48, height - 74, "TVIRTINU")
    doc.drawString(48, height - 89, "Atsakingas atstovas: Testinis Vartotojas")

    doc.setFont("FixtureArialBold", 10)
    doc.drawString(48, height - 125, "Poz. Nr.  Darbu pavadinimas  Kiekis  Vnt.")
    doc.setFont("FixtureArial", 10)
    rows = [
        "1.1 Statybvietes paruosimas 1 kompl.",
        "1.2 Asiu nuzymejimas ir geodezija 1 kompl.",
        "2.1 Grunto kasimas iki projektines altitudes 485,5 m3",
        "2.2 Smelio pagrindo irengimas ir tankinimas 216 m3",
        "Is viso 703,5",
        "SUDERINTA",
        "Puslapis 1",
    ]
    y = height - 150
    for row in rows:
        doc.drawString(48, y, row)
        y -= 22
    doc.save()


def make_image_only_pdf() -> None:
    image_target = FIXTURES / "boq-ocr-source.png"
    pdf_target = FIXTURES / "boq-image-only-ocr-smoke.pdf"
    image = Image.new("RGB", (1800, 2400), "white")
    draw = ImageDraw.Draw(image)
    regular = ImageFont.truetype(str(FONT_PATH), 34)
    bold = ImageFont.truetype(str(FONT_BOLD_PATH), 38)
    small = ImageFont.truetype(str(FONT_PATH), 28)

    draw.text((90, 80), "TECHNINIS VAIZDINIO BOQ TESTAS", font=bold, fill="black")
    draw.text((90, 140), "TVIRTINU", font=small, fill="black")
    draw.text((90, 205), "Poz. Nr.", font=bold, fill="black")
    draw.text((300, 205), "Darbu pavadinimas", font=bold, fill="black")
    draw.text((1160, 205), "Vnt.", font=bold, fill="black")
    draw.text((1340, 205), "Kiekis", font=bold, fill="black")
    draw.text((1560, 205), "Nuoroda", font=bold, fill="black")

    rows = [
        ("1.1", "Statybvietes paruosimas", "kompl.", "1", "TS-01"),
        ("1.2", "Asiu nuzymejimas ir geodezija", "kompl.", "1", "TS-02"),
        ("2.1", "Grunto kasimas", "m3", "485,5", "TS-03"),
        ("2.2", "Smelio pagrindo irengimas", "m3", "216", "TS-04"),
    ]
    y = 300
    for position, name, unit, quantity, reference in rows:
        draw.line((80, y - 22, 1720, y - 22), fill="#cbd5e1", width=2)
        draw.text((90, y), position, font=regular, fill="black")
        draw.text((300, y), name, font=regular, fill="black")
        draw.text((1160, y), unit, font=regular, fill="black")
        draw.text((1340, y), quantity, font=regular, fill="black")
        draw.text((1560, y), reference, font=regular, fill="black")
        y += 105
    draw.line((80, y - 22, 1720, y - 22), fill="#cbd5e1", width=2)
    draw.text((90, y + 35), "SUDERINTA", font=small, fill="black")

    image.save(image_target, quality=95)
    page_width, page_height = A4
    pdf = canvas.Canvas(str(pdf_target), pagesize=A4)
    pdf.drawImage(ImageReader(image), 0, 0, width=page_width, height=page_height, preserveAspectRatio=True, anchor='c')
    pdf.save()
    # Keep the source image next to the PDF so OCR regressions can be diagnosed independently
    # from PDF rendering. It is a test artifact only and is never shipped to the product UI.


if __name__ == "__main__":
    make_text_pdf()
    make_image_only_pdf()
    print("Generated text-layer and image-only OCR PDF fixtures")
