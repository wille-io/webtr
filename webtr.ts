/**
 * @file webtr.ts
 * @copyright Mike Wille <mike@wille.io>
 * @license MIT
 */


//import translations from "./tr";
let translations: Record<string, Record<string, string | null> > = {};
export function setTranslations(newTranslations: Record<string, Record<string, string | null> >)
{
  translations = newTranslations;
  go();
}


let userLang = lang();
let defaultLang = document.documentElement.lang;


function translateElement(element: Element, saveOriginalText?: boolean)
{
  // if (element.id.length > 0)
  // {
  //   console.log("translateElement for element with id", element.id);
  // }

  const text = element.textContent || "";
  //console.log("tr'd", text);
  if (saveOriginalText === true)
    element.setAttribute("data-tr-org", text);
  element.textContent = tr(text);
}


function checkNode(node: Node)
{
  for (const childNode of node.childNodes)
  {
    checkNode(childNode);
  }

  if (node.nodeType !== Node.ELEMENT_NODE)
  {
    return;
  }

  const elem = node as Element;

  if (!elem.hasAttribute("data-tr")) // only translate elements that explicitely request translations
  { 
    return;
  }

  if (elem.hasAttribute("data-tr-org"))
  {
    //console.debug("webtr: a new node was added to the dom, which was already translated / processed by this function - not translating again!");
    //console.trace("id", elem.id);
    return;
  }

  // if (elem.id.length > 0)
  // {
  //   console.log("webtr: added node with id:", elem.id);
  // }

  translateElement(elem, true);
}


const checkForNewElements = function(mutationsList: MutationRecord[])
{
  //const start = performance.now();

  for (const mutation of mutationsList)
  {
    if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE)
    {
      const elem = mutation.target as Element;

      //console.debug("webtr: data-tr changed for", elem, "data-tr =", elem.getAttribute("data-tr"));

      const newText = elem.getAttribute("data-tr");
      if (!newText || newText.length < 1) // do nothing if data-tr is empty
      {
        continue;
      }

      //console.debug("webtr: data-tr new translation!");

      elem.setAttribute("data-tr-org", newText); // set original text to the new text
      elem.textContent = tr(newText);
      elem.setAttribute("data-tr", ""); // clear data-tr again as if nothing happened (NOTE: re-triggers the observer, but exits when checking data-tr attribute text length)

      continue;
    }

    if (mutation.addedNodes.length < 1 || mutation.type !== "childList")
    {
      continue;
    }

    //console.log("node(s) was/were added!", mutation.addedNodes.length);

    for (let node of mutation.addedNodes)
    {
      checkNode(node);
    }
  }

  // const took = performance.now() - start;
  // console.log("checkForNewElements took " + took + " ms");
};


//window.addEventListener("DOMContentLoaded", () =>
function go()
{
  //console.debug("userLang", userLang);

  //defaultLang = document.getElementsByName("webtr-lang")[0]?.getAttribute("content");
  //defaultLang = document.documentElement.lang;

  // TODO: watch for html.lang change (?)
  document.documentElement.lang = userLang;

  // save original translations of all elements with 'data-tr' attribute
  document.querySelectorAll("[data-tr]").forEach((elem) => 
  {
    translateElement(elem, true);
  });

  // watch for manually added elements and directly translate them 
  const observer = new MutationObserver(checkForNewElements);
  observer.observe(document, 
    { 
      attributeFilter: ["data-tr"],
      childList: true,
      subtree: true,
    });

  //console.info("WEBTR LOADED!");
}
//);


function lang(): string
{
  if (navigator.languages && navigator.languages.length) 
    return navigator.languages[0];
  return /*navigator.userLanguage ||*/ navigator.language /*|| navigator.browserLanguage*/ || 'en-US';
}


export function changeLang(lang: string): void
{
  // TODO: check locale string

  userLang = lang;
  document.documentElement.lang = lang;

  document.querySelectorAll<HTMLElement>("[data-tr-org]").forEach((elem: HTMLElement) => 
  {
    const text = elem.getAttribute("data-tr-org");

    if (!text) // guaranteed to have that attribute (we queried it) but strict TypeScript warns here
    {
      elem.textContent = "";
      return;
    }

    let translated: string;
    if (defaultLang === userLang)
    {
      translated = text; // original document language is the new, currently set language - so use data-tr-org's content directly
    }
    else
    {
      translated = tr(text); // the new, currently selected language is different from the original document language - so get translations
    }

    elem.textContent = translated;
  });
}


// @.t.s.-.ignore (browser loads tr.js, which contains `translations`)
//let translations: Record<string, Record<string, string>>; // <= tr.js


function getTranslation(string: string): string
{
  if (defaultLang === userLang) // no need to translate anything if the requested language is the document's default language
  {
    return string;
  }

  const translation = translations[string]?.[userLang];

  if (translation === undefined) // undefined means there really is no translation - null means "use the original text"
  {
    //console.error("webtr: no translation found for:", string, "- language:", userLang);
  }

  return translation || string;
}


//const tr = (string, ...params  /*: Record<string, unknown> | unknown[]*/) => 
export function tr(string: string, ...params: any[]): string
{
  const translation = getTranslation(string);
  const things: Record<string | number, unknown> = {};

  params.forEach((value, idx) => 
  {
    //console.log("idx", idx, typeof(idx));
    // parameter is an object { "key": "value" }
    if (typeof(value) === "object")
    {
      for (let key in value)
      {
        things[key] = value[key];
      }

      return;
    }

    // parameter is a single value, where the index in the params array is the key (needs ${0}, ${1} ..)
    things[""+idx.toString()] = value;
  });

  //console.log("things", things, "translation", translation);

  try
  {
    return new Function(...Object.keys(things), `return \`${translation}\`;`)(...Object.values(things));
  }
  catch(e)
  {
    console.error("webtr: tr error: ", e);
    return translation;
  }
};