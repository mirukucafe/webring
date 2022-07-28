import Log75, { LogLevel } from 'log75';
import Express, { Request, Response } from 'express';
import { URL } from 'url';
import path from 'path';
import { readFileSync } from 'fs';
import ejs from 'ejs';

const logger = new Log75(LogLevel.Debug);
const app = Express();

type SiteConfig = { [key: string]: { https?: boolean, disabled?: boolean } }

// the horrors
const siteConfig: SiteConfig = Object.entries(
    JSON.parse(
        (readFileSync(path.join(__dirname, '..', 'sites.json'))).toString()
    ) as SiteConfig
)
    .filter(e => !e[1].disabled)
    .reduce((prev, e) => ({ ...prev, [e[0]]: e[1] }), {});
const siteList = Object.keys(siteConfig);

app.get('/embed', async (req: Request, res: Response) => {
    const site = req.header('referrer');
    res.header('Cache-Control: no-store'); // So cloudflare doesn't cache responses
    
    if (!site) {
            logger.info(`Rejecting request: No referrer header received`);
            return res.status(404).send('No referrer header received.');
    }

    try {
        const url = new URL(site);
        const index = siteList.indexOf(url.host);
        if (index == -1) {
            logger.info(`Rejecting request: ${url.host} is not whitelisted`);
            return res.status(403).send(`${url.host} is not part of this webring.`);
        }

        const prev = index == 0 ? siteList[siteList.length - 1] : siteList[index - 1];
        const next = index == siteList.length - 1 ? siteList[0] : siteList[index + 1];

        logger.info(`Rendering embed for ${url.host}`);
        res.send(
            await ejs.renderFile(
                path.join(__dirname, '..', 'views', 'ring.ejs'),
                {
                    prev: `${siteConfig[prev].https !== false ? 'https' : 'http'}://${prev}?utm_medium=ring`,
                    next: `${siteConfig[next].https !== false ? 'https' : 'http'}://${next}?utm_medium=ring`,
                    colors: {
                        fg: req.query['fg'] || '#d3a6d1',
                        bg: req.query['bg'] || '#414b67',
                        button: req.query['button'] || '#576c75',
                    },
                },
            )
        );
    } catch(e) {
        console.error(e);
        res.status(500).send('Internal server error');
    }
});

app.get('/prev', async (req: Request, res: Response) => {
    const host = req.query['host'];
    if (!host || typeof host != 'string') {
        return res.status(400).send('Please attach ?host=yoursite.tld to your request.');
    }

    const index = siteList.indexOf(host.toLowerCase());
    if (index == -1) {
        return res.status(404).send(
            'The provided hostname is not included in this webring. Make sure to only specify the hostname, without protocol or path.'
        );
    }

    const newPage = index == 0 ? siteList[siteList.length - 1] : siteList[index - 1];
    res.redirect(`${siteConfig[newPage].https !== false ? 'https' : 'http'}://${newPage}?utm_medium=ring`);
});

app.get('/next', async (req: Request, res: Response) => {
    const host = req.query['host'];
    if (!host || typeof host != 'string') {
        return res.status(400).send('Please attach ?host=yoursite.tld to your request.');
    }

    const index = siteList.indexOf(host.toLowerCase());
    if (index == -1) {
        return res.status(404).send(
            'The provided hostname is not included in this webring. Make sure to only specify the hostname, without protocol or path.'
        );
    }

    const newPage = index == siteList.length - 1 ? siteList[0] : siteList[index + 1];
    res.redirect(`${siteConfig[newPage].https !== false ? 'https' : 'http'}://${newPage}?utm_medium=ring`);
});

app.get('/', async (req: Request, res: Response) => {
    try {
        res.send(
            await ejs.renderFile(
                path.join(__dirname, '..', 'views', 'index.ejs'),
                {
                    sites: siteList.map(
                        host => `${siteConfig[host].https !== false ? 'https' : 'http'}://${host}`
                    ),
                    baseUrl: `https://${req.get('host')}`,
                    year: new Date().getFullYear()
                }
            )
        );
    } catch(e) {
        console.error(e);
        res.status(500).send('Internal server error');
    }
});

app.use(Express.static(path.join(__dirname, '..', 'static')));

app.listen(6969, () => logger.done('Listening on :6969'));
