export type ColorOption = 'auto' | 'never' | 'always';
export const ColorOptionsList: ColorOption[] = ['auto', 'never', 'always'];
export function isValidColorOption(option: string): option is ColorOption
{
	return ColorOptionsList.includes(<any>option);
}

export interface CommandLineArgs
{
	/** Show help? */
	help: boolean;

	/** Interactive? */
	interactive: boolean;

	/** Color, should be one of the types of {@link ColorOption}. */
	color: string;

	/** Search term. */
	term?: string;
}
