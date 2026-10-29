import { describe, it, expect } from "vitest";
import { parseXml, textOf, parseMeetings, plainText, decodeEntities } from "@/lib/granolaMeetings";

describe("parseXml", () => {
  it("builds a tree, decodes entities and attributes, and keeps CDATA text", () => {
    const root = parseXml('<a x="1 &amp; 2"><b>Tom &lt;3</b><c/><![CDATA[<raw>]]></a>');
    const a = root.children[0];
    expect(a.attrs.x).toBe("1 & 2");
    expect(textOf(a)).toBe("Tom <3<raw>");
    expect(a.children[1]).toMatchObject({ name: "c", children: [] });
  });

  it("survives a bare ampersand, an unclosed tag and a stray closing tag", () => {
    const root = parseXml("<x>R&D <y>open</z> still x</x>");
    expect(textOf(root)).toBe("R&D open still x");
  });

  it("decodes numeric entities", () => {
    expect(decodeEntities("&#8217;&#x2014;")).toBe("’—");
  });
});

describe("parseMeetings", () => {
  it("reads meetings described by attributes", () => {
    const text = `Found 2 meetings.
<meetings count="2">
  <meeting id="0b5c-1" title="Website relaunch sync" meeting_at="2026-10-28T14:00:00Z" url="https://notes.granola.ai/d/0b5c-1">
    <known_participants total="3" omitted="0">
      <participant name="Dana Kim" email="dana@example.com"/>
      <participant email="lee@example.com"/>
    </known_participants>
  </meeting>
  <meeting id="0b5c-2" title="Q4 planning" meeting_at="2026-10-27T18:30:00Z"/>
</meetings>
<next_cursor>abc123</next_cursor>`;
    const { meetings, nextCursor } = parseMeetings(text);
    expect(meetings).toHaveLength(2);
    expect(meetings[0]).toMatchObject({
      id: "0b5c-1",
      title: "Website relaunch sync",
      date: "2026-10-28T14:00:00Z",
      people: ["Dana Kim", "lee@example.com"],
      url: "https://notes.granola.ai/d/0b5c-1",
    });
    expect(meetings[1].title).toBe("Q4 planning");
    expect(nextCursor).toBe("abc123");
  });

  it("reads meetings described by child elements, with summary and private notes", () => {
    const text = `<meeting>
  <id>not_1d3tmYTlCICgjy</id>
  <title>1:1 with Sam</title>
  <meeting_at>2026-10-26T13:00:00Z</meeting_at>
  <participants><person>Sam Ortiz</person><person>Me</person></participants>
  <summary>## Decisions
- Launch moves to Nov 14 &amp; QA starts Monday</summary>
  <private_notes>ask about budget</private_notes>
</meeting>`;
    const [m] = parseMeetings(text).meetings;
    expect(m.id).toBe("not_1d3tmYTlCICgjy");
    expect(m.people).toEqual(["Sam Ortiz", "Me"]);
    expect(m.summary).toContain("Launch moves to Nov 14 & QA starts Monday");
    expect(m.privateNotes).toBe("ask about budget");
  });

  it("takes the outer meeting when notes are nested inside it, and drops duplicates", () => {
    const text = '<meeting id="m1" title="Standup"><note id="n1">x</note></meeting><meeting id="m1" title="Standup"/>';
    const { meetings } = parseMeetings(text);
    expect(meetings.map((m) => m.id)).toEqual(["m1"]);
  });

  it("returns no meetings, and the raw text, when the reply isn't XML", () => {
    const { meetings, raw } = parseMeetings("No meetings in the last 7 days.");
    expect(meetings).toEqual([]);
    expect(raw).toBe("No meetings in the last 7 days.");
  });

  it("names an untitled meeting", () => {
    expect(parseMeetings('<meeting id="z"/>').meetings[0].title).toBe("Untitled meeting");
  });
});

describe("plainText", () => {
  it("drops tags and collapses blank runs", () => {
    expect(plainText("<a>One</a>\n\n\n\n<b>Two &amp; three</b>")).toBe("One\n\nTwo & three");
  });
});
