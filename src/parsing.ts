import { JSDOM } from 'jsdom';

export function parse(html: string)
{
	const dom = new JSDOM(html);
	const { document, Node } = dom.window;

	const results: Result[] = [...document.querySelectorAll("#primary .concept_light")]
		.map(block =>
		{
			const jp = block.querySelector('.concept_light-representation');
			if (jp == null)
				throw new Error("Result list not found.");

			const text = jp.querySelector('.text')!.textContent!.trim();

			const items = [...block.querySelector('.meanings-wrapper')!.children]
				.map(parseItem);

			const textParts = [...jp.querySelector('.text')!.childNodes]
				.map(e =>
				{
					// Kanji are in text nodes, Kana in <span> elements.
					// Kana appear as single elements, adjacent Kanji exist in the same text node.
					const type = e.nodeType === Node.ELEMENT_NODE ? 'kana' : 'kanji';
					return Array.from(e.textContent!.trim()).map(char => ({ text: char, type }));
				})
				.reduce((arr, x) => arr.concat(x), []);

			const furiganaContainer = jp.querySelector('.furigana')!;
			// If <ruby> is used the furigana are within an <rt> tag.
			const furigana = furiganaContainer.querySelector('ruby') == null
				? [...furiganaContainer.children].map(e => e.textContent!.trim())
				: Array.from(furiganaContainer.querySelector('rt')!.textContent!.trim());
			const reading = furigana
				.map((e, i) =>
				{
					return e == ''
						// If the furigana is empty and the corresponding text is a kanji,
						// the previous furigana already contains the transcription.
						? (i >= textParts.length || textParts[i].type == 'kanji' ? '' : textParts[i].text)
						: e;
				})
				.join('');

			return { text, reading, items };
		});

	return results;
}

function parseItem(m: Element): ResultItem
{
	if (m.classList.contains('meaning-tags'))
		return {
			type: 'tag',
			text: m.textContent!.trim(),
		};

	const meaningElement = m.querySelector('.meaning-meaning');
	const text = meaningElement
		? meaningElement.textContent!.trim()
		: m.textContent!.trim();

	const numberElement = m.querySelector('.meaning-definition-section_divider');
	const number = numberElement?.textContent!.trim();

	const supplementalInfoElement = m.querySelector('.supplemental_info');

	const supplementalInfo: SupplementalInfo[] =
		supplementalInfoElement == null ? [] :
			[...supplementalInfoElement.querySelectorAll('.sense-tag')]
				.map(st =>
				{
					if (st.classList.contains('tag-tag'))
						return { type: 'tag', text: st.textContent!.trim() };

					if (st.classList.contains('tag-see_also'))
					{
						const link = st.querySelector('a')!;
						return {
							type: 'see-also',
							text: link.textContent!.trim(),
							href: link.href,
						};
					}

					return null;
				})
				.filter(x => x != null) as SupplementalInfo[];

	return {
		type: 'meaning',
		number, text, supplementalInfo,
	};
}

export interface Result
{
	text: string;
	reading: string;
	items: ResultItem[];
}

export type ResultItem = Meaning | Tag;

export type SupplementalInfo = Tag | SeeAlso;

export interface Meaning
{
	type: 'meaning';
	number?: string;
	text: string;
	supplementalInfo: SupplementalInfo[];
}

export interface Tag
{
	type: 'tag';
	text: string;
}

export interface SeeAlso
{
	type: 'see-also';
	text: string;
	href: string;
}
