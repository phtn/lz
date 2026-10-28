import { createContext, type RefObject } from 'octane'

// Where floating UI (popovers, menus, drag overlays) portals to; undefined means document.body.
// A modal <dialog> sits in the browser's top layer, so anything portaled to body renders beneath
// it and is inert. Content shown inside such a dialog provides the dialog element here.
export const PortalContainerContext = createContext<RefObject<HTMLElement | null> | undefined>(undefined)
