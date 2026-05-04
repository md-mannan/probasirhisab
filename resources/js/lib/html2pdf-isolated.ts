/**
 * Build PDF from HTML without html2pdf.js's internal clone step.
 *
 * html2pdf clones the source node onto `document.body` before calling
 * html2canvas, so capture runs in the main document and html2canvas parses
 * Tailwind's `oklch()` stylesheets → crash. We keep markup in an iframe-only
 * document and run html2canvas on `iframe.contentDocument.body`, then jsPDF.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type Margin = [number, number, number, number];

export async function savePdfFromIsolatedHtml(
    bodyInnerHtml: string,
    embeddedCss: string,
    html2pdfSettings: Record<string, unknown>,
): Promise<void> {
    const margin = (html2pdfSettings.margin as Margin) ?? [0, 0, 0, 0];
    const filename = (html2pdfSettings.filename as string) ?? 'export.pdf';
    const image = (html2pdfSettings.image as { type: string; quality: number }) ?? {
        type: 'jpeg',
        quality: 0.95,
    };
    const jsPDFOpts =
        (html2pdfSettings.jsPDF as ConstructorParameters<typeof jsPDF>[0]) ?? {};
    const html2canvasOpts =
        (html2pdfSettings.html2canvas as Record<string, unknown> | undefined) ?? {};

    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'pdf-export');
    iframe.style.cssText =
        'position:fixed;left:-12000px;top:0;width:1280px;height:2000px;border:0;opacity:0;pointer-events:none';

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
        iframe.remove();
        throw new Error('PDF iframe document unavailable');
    }

    doc.open();
    doc.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600&family=Noto+Sans+Bengali:wght@400&display=swap"/>
<style>
${embeddedCss}
html,body{margin:0;padding:8px 10px;background:#ffffff;color:#111111;}
</style></head><body>${bodyInnerHtml}</body></html>`);
    doc.close();

    await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 450);
    });
    await doc.fonts.ready;
    try {
        await doc.fonts.load('400 16px "Noto Sans Bengali"');
        await doc.fonts.load('400 16px "Noto Sans"');
    } catch {
        /* ignore */
    }

    try {
        const canvas = await html2canvas(doc.body, {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: 0,
            windowWidth: doc.body.scrollWidth,
            ...html2canvasOpts,
        });

        const pdf = new jsPDF(jsPDFOpts);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const innerWidth = pageWidth - margin[1] - margin[3];
        const innerHeight = pageHeight - margin[0] - margin[2];

        const pxFullHeight = canvas.height;
        const pxPageHeight = Math.floor(canvas.width * (innerHeight / innerWidth));
        const safePxPageHeight = Math.max(1, pxPageHeight);
        const nPages = Math.max(1, Math.ceil(pxFullHeight / safePxPageHeight));

        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        if (!pageCtx) {
            throw new Error('Canvas 2D context unavailable');
        }

        pageCanvas.width = canvas.width;

        let pdfSliceHeightMm = innerHeight;

        for (let page = 0; page < nPages; page++) {
            let slicePxHeight = safePxPageHeight;

            if (
                page === nPages - 1 &&
                pxFullHeight % safePxPageHeight !== 0
            ) {
                slicePxHeight = pxFullHeight % safePxPageHeight;
                pageCanvas.height = slicePxHeight;
                pdfSliceHeightMm =
                    (slicePxHeight * innerWidth) / canvas.width;
            } else {
                pageCanvas.height = safePxPageHeight;
                pdfSliceHeightMm = innerHeight;
            }

            pageCtx.fillStyle = '#ffffff';
            pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageCtx.drawImage(
                canvas,
                0,
                page * safePxPageHeight,
                canvas.width,
                slicePxHeight,
                0,
                0,
                canvas.width,
                slicePxHeight,
            );

            const imgData = pageCanvas.toDataURL(
                `image/${image.type}`,
                image.quality,
            );

            if (page > 0) {
                pdf.addPage();
            }

            pdf.addImage(
                imgData,
                image.type,
                margin[1],
                margin[0],
                innerWidth,
                pdfSliceHeightMm,
            );
        }

        pdf.save(filename);
    } finally {
        iframe.remove();
    }
}
