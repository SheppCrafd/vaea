const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

// Set by lib/signIn.js just before a provider sign-in redirect; read once
// when the provider sends the browser back with ?access_token=.
export const LOGIN_PENDING_KEY = 'vaea_login_pending';
const LOGIN_PENDING_MAX_AGE_MS = 15 * 60 * 1000;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function removeParamFromUrl(paramName) {
	const urlParams = new URLSearchParams(window.location.search);
	if (!urlParams.has(paramName)) return;
	urlParams.delete(paramName);
	const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
	window.history.replaceState({}, document.title, newUrl);
}

// The build's own settings. These used to accept an override from the
// query string (?app_base_url=, ?app_id=, ?functions_version=), which let
// a link on the real domain point the sign-in button at another site.
// They now always come from the build, and any such parameter is dropped.
const getBuildValue = (paramName, buildValue) => {
	if (isNode) return buildValue;
	removeParamFromUrl(paramName);
	if (buildValue) storage.setItem(`base44_${toSnakeCase(paramName)}`, buildValue);
	return buildValue || null;
}

// The session token. A token in the URL is accepted only when this tab
// started a sign-in a moment ago (LOGIN_PENDING_KEY); otherwise it's
// dropped, so nobody can sign a visitor into a session they planted.
const getAccessToken = () => {
	if (isNode) return null;
	const urlToken = new URLSearchParams(window.location.search).get('access_token');
	removeParamFromUrl('access_token');
	if (urlToken) {
		let pendingSince = 0;
		try {
			pendingSince = Number(sessionStorage.getItem(LOGIN_PENDING_KEY)) || 0;
			sessionStorage.removeItem(LOGIN_PENDING_KEY);
		} catch {
			pendingSince = 0;
		}
		if (pendingSince && Date.now() - pendingSince < LOGIN_PENDING_MAX_AGE_MS) {
			storage.setItem('base44_access_token', urlToken);
			return urlToken;
		}
	}
	return storage.getItem('base44_access_token') || null;
}

const getAppParams = () => {
	if (!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
		removeParamFromUrl('clear_access_token');
	}
	return {
		appId: getBuildValue("app_id", import.meta.env.VITE_BASE44_APP_ID),
		token: getAccessToken(),
		fromUrl: isNode ? undefined : windowObj.location?.href,
		functionsVersion: getBuildValue("functions_version", import.meta.env.VITE_BASE44_FUNCTIONS_VERSION),
		appBaseUrl: getBuildValue("app_base_url", import.meta.env.VITE_BASE44_APP_BASE_URL),
	}
}


export const appParams = {
	...getAppParams()
}
