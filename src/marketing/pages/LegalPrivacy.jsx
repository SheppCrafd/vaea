import LegalDoc from "../components/LegalDoc";

const SECTIONS = [
  {
    heading: "Scope",
    body: [
      "This policy applies to the Vaea web application and this website. In it, “we”, “us”, and “Vaea” refer to the operator of the service. Contact details are on the About page.",
    ],
  },
  {
    heading: "Summary",
    body: [
      "Your project data — areas, products, projects, tasks, stakeholders, and notes — is stored on your own device by default, in files you control. It is not transmitted to or held on a server unless you enable sync.",
      "A limited set of features rely on a server: authentication, storage of your chat history, operation of the built-in AI assistant, and — only where you enable it — sync of your board across devices. Each is described below.",
      "There are no advertising trackers, and no personal information is sold or shared for marketing. The platform Vaea is hosted on may collect basic operational telemetry, such as error and uptime data, in the course of running the service.",
    ],
  },
  {
    heading: "Data stored on your device",
    body: [
      "By default, everything you create in Vaea is written to local files on the device you use — a folder you select — or to your browser's local storage where a folder is not available. This data does not leave your device unless you take one of the actions described below.",
      "You may move, back up, export, or delete these files at any time, without a request to us.",
    ],
  },
  {
    heading: "The AI assistant",
    body: [
      "When you ask the assistant to perform a task, a copy of your current board is transmitted to an AI provider for that single request so the model can interpret your instruction. It is used to generate that one response and is not retained by us afterward. The provider's own data handling applies to that request.",
      "With the built-in option, that provider is the hosted service Vaea uses to make the call. If you connect your own AI account, the request is sent from your browser directly to that provider. If you direct the assistant to a model running on your own device, no data is transmitted off that device.",
      "If the assistant retrieves a web result, or opens a link or file you have provided, that single retrieval is performed for that request and the result is used in the response. It is not stored.",
    ],
  },
  {
    heading: "Chat history",
    body: [
      "Your conversations with the assistant — not your board — are stored by the hosted service so that they are available on your return. You may delete them. Deleting your account removes them.",
    ],
  },
  {
    heading: "Authentication",
    body: [
      "Sign-in is handled by a hosted authentication provider (Google, Microsoft, Apple, or email), which manages your login and returns a session. The application is usable as a guest without signing in; the assistant requires authentication.",
    ],
  },
  {
    heading: "Optional sync",
    body: [
      "If you enable sync, your board is copied to a hosted record associated with your account so that you can open it on another device. It is disabled unless you enable it, and you may disable it again at any time. Disabling sync does not delete the local copy on your device.",
    ],
  },
  {
    heading: "Connected accounts (calendar, email, notes)",
    body: [
      "If you connect a Google or Microsoft account, or a notes repository, the access credentials for those are stored on your device. Reading your notes passes through the hosted service only for the moment a read occurs; writing a note is sent directly from your browser to where the notes are kept. You may disconnect at any time.",
    ],
  },
  {
    heading: "What is not collected",
    body: [
      "No advertising identifiers, no third-party marketing pixels, no session recording, and no sale or sharing of personal information. Vaea adds no analytics tracking to its pages; any operational telemetry is the hosting platform's, for the purpose of running the service.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Because your data resides on your device, you already have direct access to export or delete most of it. For anything held by the hosted service — chat history, a synced board, your account — you can delete your account from the settings screen, which clears it. You may also contact us (see the About page) with any request concerning your data.",
      "Depending on your jurisdiction, you may have rights under laws such as the GDPR or CCPA to access, correct, or delete personal data, and to object to processing. We honour these requests; email is the route.",
    ],
  },
  {
    heading: "Children",
    body: [
      "Vaea is not directed at children under 13 and does not knowingly collect their personal data.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "If this policy changes, the “last updated” date above will change with it, and the revised version replaces this one on this page. Material changes will also be noted in the project's public changelog.",
    ],
  },
];

export default function LegalPrivacy() {
  return (
    <LegalDoc
      eyebrow="legal"
      title="Privacy Policy"
      intro="This policy describes what information Vaea handles, where it is stored, and the choices available to you. A plain-language overview is also available."
      companion={{ to: "/privacy", label: "Read the plain-language overview" }}
      sections={SECTIONS}
    />
  );
}
