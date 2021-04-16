export default async function ({ addon, global, console, msg }) {
  let workspace, showingConsole;
  const img = document.createElement("img");
  img.className = `debug-btn ${addon.tab.scratchClass("button_outlined-button")}`;
  img.src = addon.self.dir + "/debug.svg";
  img.draggable = false;
  img.title = msg("debug");
  img.addEventListener("click", () => toggleConsole());

  const vm = addon.tab.traps.vm;
  addon.tab.addBlock("log %s", ["content"], ({ content }, targetId, blockId) => {
    workspace = Blockly.getMainWorkspace();
    addItem(content, targetId, blockId, "log");
  });
  addon.tab.addBlock("warn %s", ["content"], ({ content }, targetId, blockId) => {
    workspace = Blockly.getMainWorkspace();
    addItem(content, targetId, blockId, "warn");
  });
  let injected;
  const goToBlock = (blockId) => {
    const offsetX = 32,
      offsetY = 32;
    const block = workspace.getBlockById(blockId);
    if (!block) return;

    // Copied from devtools. If it's code get's improved for this function, bring those changes here too.
    let root = block.getRootBlock();

    let base = block;
    while (base.getOutputShape() && base.getSurroundParent()) {
      base = base.getSurroundParent();
    }

    let ePos = base.getRelativeToSurfaceXY(), // Align with the top of the block
      rPos = root.getRelativeToSurfaceXY(), // Align with the left of the block 'stack'
      eSiz = block.getHeightWidth(),
      scale = workspace.scale,
      x = rPos.x * scale,
      y = ePos.y * scale,
      xx = block.width + x, // Turns out they have their x & y stored locally, and they are the actual size rather than scaled or including children...
      yy = block.height + y,
      s = workspace.getMetrics();
    if (
      x < s.viewLeft + offsetX - 4 ||
      xx > s.viewLeft + s.viewWidth ||
      y < s.viewTop + offsetY - 4 ||
      yy > s.viewTop + s.viewHeight
    ) {
      let sx = x - s.contentLeft - offsetX,
        sy = y - s.contentTop - offsetY;

      workspace.scrollbar.set(sx, sy);
    }
    // Flashing
    const myFlash = { block: null, timerID: null, colour: null };
    if (myFlash.timerID > 0) {
      clearTimeout(myFlash.timerID);
      myFlash.block.setColour(myFlash.colour);
    }

    let count = 4;
    let flashOn = true;
    myFlash.colour = block.getColour();
    myFlash.block = block;

    function _flash() {
      myFlash.block.svgPath_.style.fill = flashOn ? "#ffff80" : myFlash.colour;
      flashOn = !flashOn;
      count--;
      if (count > 0) {
        myFlash.timerID = setTimeout(_flash, 200);
      } else {
        myFlash.timerID = 0;
      }
    }

    _flash();
  };

  const consoleWrapper = Object.assign(document.createElement("div"), {
    className: addon.tab.scratchClass("card_card", { others: "debug" }),
  });
  const consoleTitle = Object.assign(document.createElement("h1"), {
    className: addon.tab.scratchClass("card_header-buttons"),
    innerText: msg("console"),
  });
  const consoleList = Object.assign(document.createElement("div"), {
    className: addon.tab.scratchClass("sprite-info_sprite-info", { others: "logs" }),
  });
  const closeButton = Object.assign(document.createElement("div"), {
    className: addon.tab.scratchClass("close-button_close-button", "close-button_large", { others: "close-button" }),
  });
  const closeImg = Object.assign(document.createElement("img"), {
    className: addon.tab.scratchClass("close-button_close-icon"),
    src: "/static/assets/cb666b99d3528f91b52f985dfb102afa.svg",
  });

  consoleWrapper.append(consoleTitle, consoleList);
  consoleList.append(closeButton);
  closeButton.append(closeImg);
  document.body.append(consoleWrapper);

  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  consoleTitle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    consoleWrapper.style.top = consoleWrapper.offsetTop - pos2 + "px";
    consoleWrapper.style.left = consoleWrapper.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }

  closeButton.onmousedown = () => {
    document.querySelectorAll(".log").forEach((log, i) => log.remove());
  };
  const addItem = (content, targetId, blockId, type) => {
    const wrapper = document.createElement("div");
    const span = (text, cl = "") => {
      let s = document.createElement("span");
      s.innerText = text;
      s.className = cl;
      return s;
    };
    const targetName = vm.runtime.targets.find((t) => t.id === targetId).getName();
    const scrolledDown = consoleList.scrollTop === consoleList.scrollHeight - consoleList.clientHeight;
    wrapper.classList = `log ${addon.tab.scratchClass("sprite-info_sprite-info")}`;
    if (type === "warn") wrapper.classList += " warn";
    consoleList.appendChild(wrapper);

    const block = workspace.getBlockById(blockId);
    const inputBlock = block.getChildren().find((b) => b.parentBlock_.id === blockId);
    if (inputBlock.type !== "text") {
      if (inputBlock.inputList.filter((i) => i.name).length === 0) {
        const inputSpan = document.createElement("span");
        inputSpan.innerHTML = inputBlock.svgPath_.parentElement.querySelector("text").innerHTML;
        inputSpan.className = "console-variable";
        inputSpan.style.background = getComputedStyle(inputBlock.svgPath_).fill;
        wrapper.append(inputSpan);
      }
    }
    wrapper.append(span(content));

    let link = document.createElement("a");
    link.innerText = targetName;

    link.addEventListener("click", () => goToBlock(blockId));
    wrapper.appendChild(link);
    if (scrolledDown) logs.scrollTop = logs.scrollHeight - logs.clientHeight;
  };

  const toggleConsole = (show = !showingConsole) => {
    if (show) {
      consoleWrapper.style.display = "flex";
    } else {
      consoleWrapper.style.display = "";
    }
    showingConsole = show;
  };

  while (true) {
    const button = await addon.tab.waitForElement("[class^='stage-header_stage-size-row']", { markAsSeen: true });
    if (addon.tab.editorMode == "editor") {
    button.insertAdjacentElement("afterBegin", img);
    } else {
      toggleConsole(false)
    }
  }
}
