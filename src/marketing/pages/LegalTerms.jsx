import LegalDoc from "../components/LegalDoc";

const SECTIONS = [
  {
    heading: "What Vaea is",
    body: [
      "Vaea is a free application, maintained by one person and provided as-is. Using it — the web app or this site — means you accept these terms.",
      "If a paid option is ever added it will be optional and clearly marked, and these terms will be updated first.",
    ],
  },
  {
    heading: "Your work is yours",
    body: [
      "You keep all rights to the content you create in Vaea — your projects, tasks, notes, and everything else. We claim no ownership of it and do not use it for any purpose other than running the features you ask for.",
      "Because your data is stored on your own device by default, you can take it and leave at any time. There is no lock-in.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Use Vaea for lawful purposes only. You must not use it to break the law, to attack or disrupt the hosted services it relies on, or to abuse the built-in AI assistant — for example, to generate content that is illegal or that violates the AI provider's own policies.",
      "The built-in assistant runs on a shared budget. Automated or bulk use that isn't a person working on their own board may be rate-limited or cut off. Connecting your own AI account avoids this entirely.",
    ],
  },
  {
    heading: "The AI assistant",
    body: [
      "The assistant proposes changes and acts only after you approve them. You are responsible for reviewing what it proposes before you say yes. AI output can be wrong; treat it as a draft, not an authority.",
      "When you use the built-in model, requests are subject to the underlying AI provider's terms. When you connect your own account, your agreement with that provider governs.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "Vaea is provided “as is” and “as available”, without warranties of any kind, express or implied — including fitness for a particular purpose, reliability, or that it will be uninterrupted or error-free.",
      "Keep your own backups. The app includes a same-day snapshot safety net, but it is not a substitute for backups you control.",
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      "To the maximum extent allowed by law, we are not liable for any indirect, incidental, or consequential damages, or for lost data or lost profits, arising from your use of Vaea. Since the tool is free, any direct liability is limited to the amount you paid to use it — which is nothing.",
    ],
  },
  {
    heading: "Availability and changes",
    body: [
      "Features can change or be removed, and the hosted services can go down or be discontinued, with or without notice. If the project is wound down, the app is built so your local files remain usable and the source stays public.",
      "These terms can change; the “last updated” date above will reflect it, and continued use after a change means you accept the new version.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these terms go to us — contact details are on the About page."],
  },
];

export default function LegalTerms() {
  return (
    <LegalDoc
      eyebrow="legal"
      title="Terms of Use"
      sections={SECTIONS}
    />
  );
}
