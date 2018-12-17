import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import * as puppeteer from 'puppeteer';
import * as readline from 'readline';
import { modify, Bold, Faint, FgBrightGreen, FgBrightMagenta, FgBrightYellow, FgYellow } from 'ansi-es6';

const main = async () =>
{
	const { help, interactive, term } = <CommandLineArgs>commandLineArgs([
		{ name: 'help', alias: 'h', type: Boolean, defaultValue: false },
		{ name: 'interactive', alias: 'i', type: Boolean, defaultValue: false },
		{ name: 'term', defaultOption: true, type: String },
	]);

	if (help || interactive == false && term == null)
	{
		const usage = commandLineUsage([
			{
				header: 'jisho-cli',
				content: 'Look up a term, English or Japanese, on jisho.org.'
			},
			{
				header: 'Synopsis',
				content: [
					'jisho-cli {underline term}',
					'jisho-cli {bold -i} [{underline term}]',
				]
			},
			{
				header: 'Options',
				optionList: [
					{
						alias: 'i',
						name: 'interactive',
						description: 'If set, the application executes interactively. Faster when looking up multiple terms.'
					},
					{
						alias: 'h',
						name: 'help',
						description: 'Print this message.'
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

	const question = (q: string) => new Promise<string>(res =>
	{
		readInterface.question(q, res);
	});

	const browser = await puppeteer.launch({
		// TODO: remove if possible
		args: ["--no-sandbox"]
	});
	const page = await browser.newPage();

	let needInput = term == null;
	while (true)
	{
		const rawTerm = needInput ?
			await question(autoModify("Search term: ", FgBrightYellow)) : term!;

		const currentTerm = rawTerm.trim();
		if (currentTerm == '')
			break;

		needInput = true;

		if (process.stdout.isTTY)
			process.stdout.write(autoModify('Searching...', FgYellow));

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
			const results = await lookUpTerm(page, currentTerm);
			clr();
			
			results.forEach(result =>
			{
				console.log(`${autoModify(result.text, Bold, FgBrightGreen)} [${autoModify(result.reading, FgBrightMagenta)}]:`);
				result.meanings.forEach((m, i) => console.log(`\t${autoModify(`${i + 1}:`, Faint)} ${m}`));
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

	await page.close();
	await browser.close();
	readInterface.close();
}

const autoModify = (text: string, ...modifiers: string[]) =>
{
	return process.stdout.isTTY ? modify(text, ...modifiers) : text;
}

async function lookUpTerm(page: puppeteer.Page, term: string): Promise<Result[]>
{
	await page.goto(`http://jisho.org/search/${term}`);
	const results: Result[] = await page.evaluate(() =>
	{
		return Array.from(document.querySelectorAll("#primary .concept_light")).map(block =>
		{
			const jp = block.querySelector('.concept_light-representation');
			if (jp == null)
				throw new Error("Result list not found.");
			const text = jp.querySelector('.text')!.textContent!.trim();
			const meanings = Array.from(block.querySelectorAll('.meaning-meaning')).map(m => m.textContent!.trim());
			const textParts = [...jp.querySelector('.text')!.childNodes]
				.map(e => e.textContent!.trim().split(''))
				.reduce((arr, x) => arr.concat(x), []);
			const reading = [...jp.querySelector('.furigana')!.children]
				.map((e, i) => e.textContent!.trim() == '' ? textParts[i] : e.textContent!.trim())
				.join('');
			return { text, reading, meanings };
		});
	});

	return results;
}

main();

interface Result
{
	text: string;
	reading: string;
	meanings: string[];
}

interface CommandLineArgs
{
	/** Show help? */
	help: boolean;

	/** Interactive? */
	interactive: boolean;

	/** Search term. */
	term?: string;
}
