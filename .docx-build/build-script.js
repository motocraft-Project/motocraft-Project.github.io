const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle
} = require("docx");

const NAVY = "10213F";
const BLUE = "3476ED";
const MUTED = "5B6475";

function speakerHeading(number, name, topic) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 8 } },
    children: [
      new TextRun({ text: `SPEAKER ${number}`, color: BLUE, bold: true, size: 20 }),
      new TextRun({ text: `  ·  ${name}`, color: MUTED, bold: false, size: 20 }),
    ],
  });
}

function topicLine(text) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, italics: true, color: MUTED, size: 20 })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}

function handoff(text) {
  return new Paragraph({
    spacing: { before: 80, after: 0, line: 276 },
    children: [new TextRun({ text, size: 22, italics: true, color: NAVY })],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: "1B2430" } },
    },
    paragraphStyles: [
      {
        id: "Title", name: "Title", basedOn: "Normal", next: "Normal",
        run: { font: "Calibri", size: 44, bold: true, color: NAVY },
        paragraph: { spacing: { after: 60 }, keepNext: true },
      },
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { font: "Calibri", size: 24, bold: true, color: NAVY },
        paragraph: { spacing: { before: 320, after: 60 }, keepNext: true, outlineLevel: 0 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1000, bottom: 1000, left: 1260, right: 1260 },
        },
      },
      children: [
        new Paragraph({
          style: "Title",
          children: [new TextRun({ text: "MOTOCRAFT", size: 44, bold: true, color: NAVY })],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: "Presentation script, four speakers", size: 22, color: MUTED })],
        }),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E1E6EE", space: 10 } },
          spacing: { after: 200 },
          children: [new TextRun({ text: "About 5 minutes total, roughly one minute per speaker. Read each part aloud as written.", size: 18, italics: true, color: MUTED })],
        }),

        speakerHeading(1, "[Name]", "Tech stack and security"),
        topicLine("What it's built with, and how the AI is kept secure."),
        p("Hi everyone, I'm [Speaker 1]. MOTOCRAFT is built with Next.js, React, and TypeScript on the front end, and Vercel serverless functions on the back end that call Groq for AI and the NHTSA's own database to verify VINs for free."),
        p("On security: the Groq API key never reaches the browser, it stays on the server. Every AI request needs a private access code, checked with a timing-safe comparison, we rate-limit by IP, and every request is validated before it's processed. When someone pastes a listing link, the server refuses to fetch localhost or private network addresses, so it can't be turned against our own infrastructure. And if a request with photos gets too large for the AI provider, it automatically retries with text only instead of failing."),
        handoff("Now, [Speaker 2] will tell you what MOTOCRAFT does."),

        speakerHeading(2, "[Name]", "About the application, part 1"),
        topicLine("What MOTOCRAFT is, and the modules it's built from."),
        p("Thanks. Used-car dealerships juggle inventory, repairs, sales, and finances, often across spreadsheets that don't talk to each other. MOTOCRAFT puts it all in one workspace: Vehicle Inventory, Acquisitions, Repairs, Sales, Customers, Invoices, and full financial reporting."),
        p("Every vehicle has one profile that follows it from purchase to sale: what it cost, what was spent fixing it, and exactly how much profit it made. The dashboard shows inventory, revenue, and gross profit at a glance, and everything exports to CSV, Excel, or PDF. It also mirrors a real dealership's roles, Administrator, Manager, and Employee, each seeing only what they should."),
        handoff("Now [Speaker 3] will show you what using it actually feels like."),

        speakerHeading(3, "[Name]", "About the application, part 2"),
        topicLine("A quick walk through daily use."),
        p("Thanks. You land on the dashboard, then the sidebar takes you anywhere you need. Bring in a vehicle, log its acquisition cost, track repairs as it's reconditioned, then mark it for sale and finalize it, which updates profit automatically. Every record opens into a full detail view, so nothing's scattered across screens."),
        p("This is a live, in-browser demo, so you're free to explore; nothing's permanent, and one click resets it to sample data."),
        handoff("And right next to all of this day-to-day work sits the newest module: AI Analysis. That's where MOTOCRAFT stops just keeping records and starts helping you decide. Here's [Speaker 4]."),

        speakerHeading(4, "[Name]", "Where AI is used, and how it helps"),
        topicLine("The three-step AI flow, and a real example."),
        p("Thanks. Buying a used vehicle means scattered evidence and minutes to decide. AI Analysis turns that into one decision, fast, in three steps."),
        p("First, feed it evidence: paste a listing link and it pulls the VIN, price, and specs automatically; upload a PDF or photo and load it in one click; or just speak your notes."),
        p("Second, the AI does the work: a Groq language model reads the text, a vision model reads photos, and every VIN is checked against NHTSA's federal database, catching mismatched specs or invalid VINs, while the listing itself gets scanned for scam signals."),
        p("Third, you get a verdict: worth it, negotiate, or pass, with a maximum purchase price, repair estimate, projected retail, and profit, all with its reasoning shown."),
        p("We tested it live: uploaded a ten-page PDF for a Jeep Wrangler, hit Load, hit Analyze, and in seconds got Negotiate, with a maximum purchase matched to the real price of $26,263."),
        p("It's conservative, and it's honest about what it doesn't know. That's MOTOCRAFT: buy with evidence, not instinct. Thank you.", { bold: true, color: NAVY }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("script.docx", buf);
  console.log("Wrote script.docx");
});
