import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import { fetch } from 'undici';
import { JSDOM } from 'jsdom';
import * as readline from 'readline';
import { modify, Bold, Faint, FgBrightGreen, FgBrightMagenta, FgBrightYellow, FgYellow, FgCyan } from 'ansi-es6';
import { CommandLineArgs, ColorOption, isValidColorOption } from './command-line';

const main = async () =>
{
	const { help, interactive, term, color } = <CommandLineArgs>commandLineArgs([
		{ name: 'help', alias: 'h', type: Boolean, defaultValue: false },
		{ name: 'interactive', alias: 'i', type: Boolean, defaultValue: false },
		{ name: 'color', alias: 'c', type: String, defaultValue: 'auto' },
		{ name: 'term', defaultOption: true, type: String },
	]);

	if (isValidColorOption(color) == false)
	{
		console.error(`Invalid value for 'color': ${color}`);
		process.exit(1);
	}

	if (help || interactive == false && term == null)
	{
		const usage = commandLineUsage([
			{
				header: 'jisho-cli',
				content: 'Look up a term, English or Japanese, on jisho.org.',
			},
			{
				header: 'Synopsis',
				content: [
					'jisho-cli [options] {underline term}',
					'jisho-cli [options] {bold -i} [{underline term}]',
				]
			},
			{
				header: 'Options',
				optionList: [
					{
						alias: 'i',
						name: 'interactive',
						description: 'If set, the application executes interactively. Faster when looking up multiple terms.',
					},
					{
						alias: 'c',
						name: 'color',
						description: 'Enables or disables color output.' +
							' Valid values are: {underline auto} (default), {underline always}, {underline never}.' +
							'\n{underline auto} enables coloring for TTYs.',
					},
					{
						alias: 'h',
						name: 'help',
						description: 'Print this message.',
					}
				]
			}
		]);
		console.log(usage);
		process.exit(1);
	}

	// To catch Ctrl+D
	readline.emitKeypressEvents(process.stdin);
	if (process.stdin.isTTY)
		process.stdin.setRawMode!(true);

	const readInterface = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: process.stdin.isTTY,
	});

	const colorize = conditionalModify(useColor(<ColorOption>color));

	const question = (q: string) => new Promise<string>(res =>
	{
		readInterface.question(q, answer =>
		{
			console.log();
			res(answer);
		});
	});

	let needInput = term == null;
	while (true)
	{
		const rawTerm = needInput ?
			await question(colorize("Search term: ", FgBrightYellow)) : term!;

		const currentTerm = rawTerm.trim();
		if (currentTerm == '')
			break;

		needInput = true;

		if (process.stdout.isTTY)
			process.stdout.write(colorize('Searching...', FgYellow));

		const clr = () =>
		{
			if (process.stdout.isTTY)
			{
				readline.clearLine(process.stdout, -1);
				readline.cursorTo(process.stdout, 0);
			}
		};

		try
		{
			const results = await lookUpTerm(currentTerm);
			clr();

			results.forEach(result =>
			{
				console.log(`${colorize(result.text, Bold, FgBrightGreen)} [${colorize(result.reading, FgBrightMagenta)}]:`);
				result.meanings.forEach(m =>
				{
					switch (m.type)
					{
						case 'meaning':
							const prefix = m.number === undefined
								? ''
								: (colorize(m.number, Faint) + ' ');

							console.log(`\t${prefix}${m.text}`);
							break;
						case 'tag':
							console.log(`\t${colorize(m.text, FgCyan)}`);
							break;
					}
				});
				console.log();
			});
		}
		catch (e)
		{
			clr();

			console.error("An error occurred fetching the results.");
			console.error(e);
		}

		if (interactive == false)
			break;
	}

	readInterface.close();
}

const useColor = (colorArgument: ColorOption) =>
{
	switch (colorArgument)
	{
		case 'auto':
			return 'NO_COLOR' in process.env == false && process.stdout.isTTY == true;
		case 'always':
			return true;
		case 'never':
			return false;
	}
}

const conditionalModify = (useColor: boolean) => (text: string, ...modifiers: string[]) =>
{
	return useColor ? modify(text, ...modifiers) : text;
}

async function lookUpTerm(term: string): Promise<Result[]>
{
	const response = await fetch(`http://jisho.org/search/${term}`);
	if (response.ok == false)
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);

	const html = await response.text();
	const dom = new JSDOM(html);
	const { document, Node } = dom.window;

	const results: Result[] = [...document.querySelectorAll("#primary .concept_light")]
		.map(block =>
		{
			const jp = block.querySelector('.concept_light-representation');
			if (jp == null)
				throw new Error("Result list not found.");

			const text = jp.querySelector('.text')!.textContent!.trim();

			const meanings = [...block.querySelector('.meanings-wrapper')!.children]
				.map(m =>
				{
					const type: MeaningType = m.classList.contains('meaning-tags')
						? 'tag'
						: 'meaning';

					let text: string;
					let number: string | undefined;
					switch (type)
					{
						case 'tag':
							text = m.textContent!.trim();
							break;
						case 'meaning':
							const meaningElement = m.querySelector('.meaning-meaning');
							text = meaningElement
								? meaningElement.textContent!.trim()
								: m.textContent!.trim();

							const numberElement = m.querySelector('.meaning-definition-section_divider');
							if (numberElement)
								number = numberElement.textContent!.trim();
							break;
						default:
							throw Error(`Unknown type: ${type}`);
					}

					return { type, number, text };
				});

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
				: Array.from(furiganaContainer.querySelector('rt')!.textContent!.trim())
			const reading = furigana
				.map((e, i) =>
				{
					return e == ''
						// If the furigana is empty and the corresponding text is a kanji,
						// the previous furigana already contains the transcription.
						? (i >= textParts.length || textParts[i].type == 'kanji' ? '' : textParts[i].text)
						: e
				})
				.join('');

			return { text, reading, meanings };
		});

	return results;
}

main();

type MeaningType = 'tag' | 'meaning';

interface Meaning
{
	type: MeaningType;
	number?: string;
	text: string;
}

interface Result
{
	text: string;
	reading: string;
	meanings: Meaning[];
}
