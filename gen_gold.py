import base64

def get_b64(filename):
    with open(filename, "rb") as f:
        return base64.b64encode(f.read()).decode()

with open("templates_gold.txt", "w") as f:
    f.write(f"docx: {get_b64('empty.docx')}\n")
    f.write(f"xlsx: {get_b64('empty.xlsx')}\n")
    f.write(f"pptx: {get_b64('empty.pptx')}\n")
