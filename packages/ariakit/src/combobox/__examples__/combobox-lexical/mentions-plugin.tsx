import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ComboboxItem, ComboboxPopover, ComboboxState } from "ariakit/combobox";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  KEY_ESCAPE_COMMAND,
  LexicalEditor,
  RangeSelection,
  TextNode,
} from "lexical";
import { defaultTriggers } from "./list";
import { MentionNode } from "./mention-node";

function getTextUpToAnchor(selection: RangeSelection) {
  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return "";
  }
  const anchorNode = anchor.getNode();
  // We should not be attempting to extract mentions out of nodes
  // that are already being used for other core things. This is
  // especially true for immutable nodes, which can't be mutated at all.
  if (!anchorNode.isSimpleText()) {
    return "";
  }
  const anchorOffset = anchor.offset;
  return anchorNode.getTextContent().slice(0, anchorOffset);
}

function getMentionsTextToSearch(editor: LexicalEditor) {
  let text = "";
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    text = getTextUpToAnchor(selection);
  });
  return text;
}

function getTriggerOffset(value: string, triggers = defaultTriggers) {
  for (let i = value.length; i >= 0; i--) {
    const char = value[i];
    if (char && triggers.includes(char)) {
      return i;
    }
  }
  return -1;
}

function getTrigger(value: string, triggers = defaultTriggers) {
  const previousChar = value[value.length - 1];
  if (!previousChar) return null;
  const secondPreviousChar = value[value.length - 2];
  const isIsolated = !secondPreviousChar || /\s/.test(secondPreviousChar);
  if (!isIsolated) return null;
  if (triggers.includes(previousChar)) return previousChar;
  return null;
}

function getSearchValue(value: string, triggers = defaultTriggers) {
  const offset = getTriggerOffset(value, triggers);
  if (offset === -1) return "";
  return value.slice(offset + 1);
}

// function tryToPositionRange(match: MentionMatch, range: Range): boolean {
//   const domSelection = window.getSelection();
//   if (domSelection === null || !domSelection.isCollapsed) {
//     return false;
//   }
//   const anchorNode = domSelection.anchorNode;
//   const startOffset = match.leadOffset;
//   const endOffset = domSelection.anchorOffset;
//   try {
//     range.setStart(anchorNode, startOffset);
//     range.setEnd(anchorNode, endOffset);
//   } catch (error) {
//     return false;
//   }

//   return true;
// }

export default function MentionsPlugin({
  state,
  setAnchorRect,
}: {
  state: ComboboxState;
  setAnchorRect: (...args: any[]) => any;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([MentionNode])) {
      throw new Error("MentionsPlugin: MentionNode not registered on editor");
    }
  }, [editor]);

  useEffect(() => {
    const updateListener = () => {
      const value = getMentionsTextToSearch(editor);
      const triggerOffset = getTriggerOffset(value);
      const searchValue = getSearchValue(value);
      const trigger = getTrigger(value);
      const range = document.createRange();
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const element = editor.getElementByKey(selection.anchor.key);
        if (triggerOffset !== -1 && element) {
          state.anchorRef.current = element;
          range.setStart(element!.childNodes[0]!, triggerOffset);
          range.collapse();
        }
      });
      setAnchorRect(() => () => range.getBoundingClientRect());
      if (trigger) {
        state.show();
      }
      // let anchorNode: TextNode | null = null;
      // editor.getEditorState().read(() => {
      //   const selection = $getSelection();
      //   if (!$isRangeSelection(selection)) {
      //     return;
      //   }
      //   anchorNode = selection.anchor.getNode();
      // });
      // range.setStart(anchorNode!, triggerOffset);
    };
    const removeUpdateListener = editor.registerUpdateListener(updateListener);

    const unregisterCommand = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (payload: KeyboardEvent) => {
        return true;
      },
      COMMAND_PRIORITY_NORMAL
    );

    return () => {
      removeUpdateListener();
      unregisterCommand();
    };
  }, [editor]);

  return (
    <ComboboxPopover state={state} className="popover">
      <ComboboxItem value="Apple" className="combobox-item" />
      <ComboboxItem value="Banana" className="combobox-item" />
      <ComboboxItem value="Cherry" className="combobox-item" />
    </ComboboxPopover>
  );
}