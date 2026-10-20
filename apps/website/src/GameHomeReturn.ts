// A small website-shell repair for the deployed game's native modal dialogs.
// Kept independent of React / the game runtime so a homepage release can use it
// without replacing the frozen game's code, art or saves.
export function installGameHomeReturn() {
  const links = new Set<HTMLAnchorElement>();
  const refresh = (link: HTMLAnchorElement) => {
    const lang = document.documentElement.lang;
    const locale = lang === 'en' || lang === 'zh-TW' ? lang : 'zh-CN';
    const publicSite = /^(?:(?:xiyou|sanguo|shuihu|honglou)\.)?fourealms\.com$/.test(
      location.hostname,
    );
    const url = new URL('/', publicSite ? 'https://fourealms.com/' : location.origin);
    url.searchParams.set('lang', locale);
    link.href = url.href;
    link.textContent = locale === 'en' ? '← Return to the four worlds' : '← 返回四方天地';
    link.setAttribute('aria-label', locale === 'en' ? 'Return to the four worlds' : '返回四方天地');
  };
  const attach = (dialog: HTMLDialogElement) => {
    if (!dialog.open || !dialog.matches('.xiyou-dialog')) return;
    if (dialog.querySelector('[data-portal-return]')) return;
    const link = document.createElement('a');
    link.className = 'button series-button series-button--quiet';
    link.dataset.portalReturn = 'true';
    refresh(link);
    dialog.append(link);
    links.add(link);
  };
  const inspect = (element: Element) => {
    if (element instanceof HTMLDialogElement) attach(element);
    element.querySelectorAll<HTMLDialogElement>('dialog.xiyou-dialog[open]').forEach(attach);
  };
  inspect(document.body);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target instanceof HTMLDialogElement) attach(record.target);
      for (const node of record.addedNodes) if (node instanceof Element) inspect(node);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open'],
  });
  const language = new MutationObserver(() => links.forEach(refresh));
  language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return () => {
    observer.disconnect();
    language.disconnect();
    links.forEach((link) => link.remove());
  };
}
