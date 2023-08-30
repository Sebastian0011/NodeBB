import fs from 'fs';
import path from 'path';
import utils from './utils';
import { paths } from './constants';
import plugins from './plugins';

interface Language {
    name: string
    code: string
    dir: string
}

interface LanguageGetDict {
    language: string
    namespace: string
    data: Language
}

const languagesPath = path.join(__dirname, '../build/public/language');
const files = fs.readdirSync(path.join(paths.nodeModules, '/timeago/locales'));

export const timeagoCodes = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);

export async function get(language: string, namespace: string) : Promise<Language> {
    const pathToLanguageFile : string = path.join(languagesPath, language, `${namespace}.json`);
    if (!pathToLanguageFile.startsWith(languagesPath)) {
        throw new Error('[[error:invalid-path]]');
    }
    const data = await fs.promises.readFile(pathToLanguageFile, 'utf8');
    const parsed = JSON.parse(data) as Language || {};
    const result = await plugins.hooks.fire('filter:languages.get', {
        language,
        namespace,
        data: parsed,
    }) as LanguageGetDict;

    const output : Language = result.data;
    return output;
}

let codeCache : null | string[] = null;
export async function listCodes() : Promise<string[]> {
    if (codeCache && codeCache.length) {
        return codeCache;
    }
    try {
        const file = await fs.promises.readFile(path.join(languagesPath, 'metadata.json'), 'utf8');
        const parsed = JSON.parse(file) as { languages : string[] };

        codeCache = parsed.languages;
        return parsed.languages;
    } catch (err: unknown) {
        if (err instanceof Error) {
            // Maybe needs to be code
            if (err.message === 'ENOENT') {
                return [];
            }
            throw err;
        }
    }
}

let listCache : null | Language[] = null;
export async function list() : Promise<Language[]> {
    if (listCache && listCache.length) {
        return listCache;
    }

    const codes = await listCodes();

    let languages = await Promise.all(codes.map(async (folder) => {
        try {
            const configPath = path.join(languagesPath, folder, 'language.json');
            const file = await fs.promises.readFile(configPath, 'utf8');
            const lang = JSON.parse(file) as Language;
            return lang;
        } catch (err) {
            if (err instanceof Error) {
                // Maybe needs to be code
                if (err.message === 'ENOENT') {
                    return;
                }
                throw err;
            }
        }
    }));

    // filter out invalid ones
    languages = languages.filter(lang => lang && lang.code && lang.name && lang.dir);

    listCache = languages;
    return languages;
}

export async function userTimeagoCode(userLang : string) : Promise<string> {
    const languageCodes = await listCodes();
    const timeagoCode = utils.userLangToTimeagoCode(userLang) as string;
    if (languageCodes.includes(userLang) && timeagoCodes.includes(timeagoCode)) {
        return timeagoCode;
    }
    return '';
}
