// Utility: get textContent, fallbacks for old IE
function getCellText(cell) {
  if (typeof cell.textContent !== "undefined")
    return cell.textContent.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  return cell.innerText.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

// Utility: copy text to clipboard (IE11+safe)
function copyTextToClipboard(text) {
  if (window.clipboardData && window.clipboardData.setData) {
    // IE-specific clipboardData API
    return window.clipboardData.setData("Text", text);
  } else if (
    document.queryCommandSupported &&
    document.queryCommandSupported("copy")
  ) {
    var textarea = document.createElement("textarea");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (err) {}
    document.body.removeChild(textarea);
  }
}

// Popup notification (no CSS needed)
// Modified: accepts rowName, displays "Copied Row: <rowName>"
function showCopiedPopup(target, rowName) {
  var popup = document.createElement("div");
  popup.innerHTML = "Copied Row '" + rowName + "'";
  popup.style.position = "fixed";
  popup.style.left = window.innerWidth / 2 - 120 + "px";
  popup.style.top = window.innerHeight / 2 - 30 + "px";
  popup.style.background = "#222";
  popup.style.color = "#fff";
  popup.style.padding = "12px 32px";
  popup.style.fontSize = "1.3em";
  popup.style.borderRadius = "10px";
  popup.style.boxShadow = "0 2px 16px rgba(0,0,0,0.15)";
  popup.style.zIndex = 9999;
  popup.style.opacity = "0.95";
  popup.style.textAlign = "center";
  document.body.appendChild(popup);
  setTimeout(function () {
    document.body.removeChild(popup);
  }, 1200);
}

function isTextNodeOrChildOfText(node, event) {
  // Only trigger on the actual background (not text)
  // if triple click is on a text node or inline element (child), ignore
  var t = event.target;
  if (t !== node) return true; // clicked on child
  if (event.target.nodeType && event.target.nodeType === 3) return true;
  return false;
}

window.onload = function () {
  var table = document.getElementsByTagName("table")[0];
  if (!table) return;

  // Get tbody and rows
  var tbody = table.getElementsByTagName("tbody")[0];
  var rows = tbody.getElementsByTagName("tr");

  // Header row/TSV
  var headerRow = table.getElementsByTagName("tr")[0];
  var headerCells = headerRow.getElementsByTagName("th");
  var headerTSV = [];
  for (var i = 0; i < headerCells.length; ++i) {
    headerTSV.push(getCellText(headerCells[i]));
  }

  // Triple-click handler for rows and header
  function setupTripleClick(cell, getTSV, getName, isHeader) {
    cell.onclick = function (e) {
      e = e || window.event;
      if (e.detail !== 3) return;
      if (isTextNodeOrChildOfText(cell, e)) return;

      e.preventDefault();
      if (window.getSelection) window.getSelection().removeAllRanges();
      else if (document.selection) document.selection.empty();

      var tsv = getTSV();
      copyTextToClipboard(tsv);

      var rowName = getName();
      showCopiedPopup(cell, isHeader ? "Header" : rowName);
    };
    cell.style.cursor = "default";
  }

  // Header row (allow triple-click on first TH)
  var firstHeaderCell = headerRow.getElementsByTagName("th")[0];
  if (firstHeaderCell) {
    setupTripleClick(
      firstHeaderCell,
      function () {
        return headerTSV.join("\t");
      },
      function () {
        return getCellText(firstHeaderCell);
      },
      true
    );
  }

  // Data rows
  for (var r = 0; r < rows.length; ++r) {
    (function (r) {
      var cell = rows[r].getElementsByTagName("td")[0];
      if (!cell) return;

      setupTripleClick(
        cell,
        function () {
          // Only row, no header
          var cells = rows[r].getElementsByTagName("td");
          var rowTSV = [];
          for (var j = 0; j < cells.length; ++j) {
            rowTSV.push(getCellText(cells[j]));
          }
          return rowTSV.join("\t");
        },
        function () {
          return getCellText(cell);
        },
        false
      );
    })(r);
  }
};
