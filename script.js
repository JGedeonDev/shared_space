// --------------------------------------
// FIREBASE
// --------------------------------------

firebase.initializeApp({
  apiKey: "AIzaSyB-p9Svo1wF4CDuFpl9UiGbcBbd2XZTbdo",
  authDomain: "congressional-app-99a69.firebaseapp.com",
  projectId: "congressional-app-99a69",
  storageBucket: "congressional-app-99a69.firebasestorage.app",
  messagingSenderId: "842386588638",
  appId: "1:842386588638:web:0a1f0488f8d8a9e3d5534f"
});
const db = firebase.firestore();

// --------------------------------------
// GET THE HTML ELEMENTS
// --------------------------------------
const USE_FIREBASE = true; // Set to false to run without Firebase (to save limited data dear Camelia)
const treeContainer = document.getElementById("treeContainer");
const tree = document.getElementById("tree");
const fileInput = document.getElementById("fileInput");
const mainStar = document.querySelector(".mainStar");
const password = document.getElementById("password");
const username = document.getElementById("username");
const login = document.querySelector(".login");
const homeContainer = document.querySelector(".homeContainer");
const zoomedContainer = document.getElementById("zoomedContainer");
const highlight = document.getElementById("highlight");
const exit = document.getElementById("exit");
const upArrow = document.getElementById("upArrow");
const downLeftArrow = document.getElementById("downLeftArrow");
const downRightArrow = document.getElementById("downRightArrow");
const downArrow = document.getElementById("downArrow");
const leftArrow = document.getElementById("leftArrow");
const mnLeftArrow = document.getElementById("mnLeftArrow");
const rightArrow = document.getElementById("rightArrow");
const upSecondArrow = document.getElementById("upSecondArrow");
const mnRightArrow = document.getElementById("mnRightArrow");
const mnDownArrow = document.getElementById("mnDownArrow");
const mnUpArrow = document.getElementById("mnUpArrow");
const mnDownLeftArrow = document.getElementById("mnDownLeftArrow");
const mnDownRightArrow = document.getElementById("mnDownRightArrow");
let zoomedNode = null;
const reactionList = document.getElementById("reactionList");
const addReaction = document.getElementById("addReaction");
const emojiPicker = document.getElementById("emojiPicker");

// --------------------------------------
// SETTINGS TO DISPLAY LOGIN OR NOT
// --------------------------------------

// The tree stays hidden (and unclickable) until the user logs in
let loggedIn = false; // Set to false to require login
treeContainer.style.display = "none"; // St none trl
mainStar.style.display = "block"; // st block trl

// --------------------------------------
// NODE SETTINGS
// --------------------------------------

const NODE_SIZE = 100; // Size of each photo
const DISTANCE = 300;  // Distance between nodes
const PADDING = 200;   // Empty space around the tree
const MIN_NODE_GAP = NODE_SIZE * 1.5; // Nodes closer than this count as overlapping
const LINE_CLEARANCE = NODE_SIZE * 0.75; // A line must stay at least this far from a node's center

// Dashed square with a plus sign, shown on empty nodes
const PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect x="4" y="4" width="92" height="92" rx="12" fill="none" ' +
  'stroke="white" stroke-width="4" stroke-dasharray="10 8"/>' +
  '<path d="M50 30v40M30 50h40" stroke="white" stroke-width="4"/></svg>'
);

// --------------------------------------
// TREE DATA
// --------------------------------------

// Every node is stored here (kept in sync with Firestore)
const nodes = {};

// Remembers which empty node the user clicked
let selectedNode = null;

// --------------------------------------
// STAR CLICK: LOGIN, THEN CREATE ROOT IF NEEDED
// --------------------------------------

// Turns a username into the email address Firebase needs
function usernameToEmail(name) {
  return name.trim().toLowerCase() + "@sharedspace.app";
}

mainStar.addEventListener("click", async () => {
  if (username.value === "" && password.value === "") {
    login.style.display = "block";
    return;
  }

  // Check the username and password with Firebase
  try {
    await firebase.auth().signInWithEmailAndPassword(usernameToEmail(username.value), password.value);
  } catch (error) {
    console.error("Sign-in failed:", error.code, error.message);
    alert("Wrong username or password.");
    return;
  }

  loggedIn = true;
  homeContainer.style.display = "none";
  treeContainer.style.display = "block";
  drawTree();

});

// The first empty placeholder in the center of the screen
function createRoot() {
  const root = {
    id: "root",
    x: treeContainer.clientWidth / 2,
    y: treeContainer.clientHeight / 2,
    angle: null,
    parent: null,
    isRoot: true,
    image: null
  };

  // Test mode: keep it in memory and draw it
  if (!USE_FIREBASE) {
    nodes.root = root;
    drawTree();
    return;
  }

  return nodesCollection().doc("root").set(root);
}

// --------------------------------------
// WHICH TREE TO USE (a new one each day)
// --------------------------------------

const DAILY_RESET = true;   // false = one permanent tree 

// Today's date as YYYY-MM-DD in one fixed time zone, so every visitor has same day change
function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" }); //Because Indiana is cool, but D.C. has Nando's...
}

function getTreeName() {
  if (DAILY_RESET) {
    return "nodes_" + todayKey();
  }
  return "nodes";
}

const TREE_NAME = getTreeName();

function nodesCollection() {
  return db.collection(TREE_NAME);
}

// A page left open past midnight reloads itself into the new day's tree
if (DAILY_RESET) {
  setInterval(function () {
    if (getTreeName() !== TREE_NAME) {
      location.reload();
    }
  }, 60000);
}

// --------------------------------------
// MAKE SURE TODAY'S TREE HAS A ROOT
// --------------------------------------

// A new day's collection starts empty, so the first visitor creates the root
function ensureRoot() {
  nodesCollection().doc("root").get().then(doc => {
    if (!doc.exists) {
      createRoot();
    }
  });
}

// --------------------------------------
// SHRINK A PHOTO SO IT FITS IN FIRESTORE
// --------------------------------------

const MAX_IMAGE_SIZE = 600;   // longest side of saved photos, in pixels
const IMAGE_QUALITY = 0.85;   // JPEG quality, 0 to 1

function shrinkImage(file, callback) {
  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    URL.revokeObjectURL(url);

    // Never enlarge a photo that's already small
    const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(img.width, img.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d");

    // White background so transparent PNGs don't turn black
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // High-quality smoothing when shrinking
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert("Sorry, that photo couldn't be opened. Try a JPG or PNG.");
  };

  img.src = url;
}
// --------------------------------------
// LISTEN FOR CHANGES IN FIRESTORE
// --------------------------------------

let stopListening = null;

function startListening() {
  if (stopListening) return;   // already listening

  stopListening = nodesCollection().onSnapshot(
    snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") {
          delete nodes[change.doc.id];
        } else {
          nodes[change.doc.id] = change.doc.data();
        }
      });
      drawTree();
      renderReactions();
    },
    error => console.error("Firestore listener error:", error)
  );
}

// Runs when someone signs in, and again on a page refresh if they're still signed in
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    startListening();
    ensureRoot();
  }
});
// --------------------------------------
// DRAW THE WHOLE TREE
// --------------------------------------

function drawTree() {

  tree.innerHTML = "";

  const allNodes = Object.values(nodes);

  if (allNodes.length === 0) {
    return;
  }

  // Find how large the tree is
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  allNodes.forEach(node => {
    minX = Math.min(minX, node.x - NODE_SIZE / 2);
    maxX = Math.max(maxX, node.x + NODE_SIZE / 2);
    minY = Math.min(minY, node.y - NODE_SIZE / 2);
    maxY = Math.max(maxY, node.y + NODE_SIZE / 2);
  });

  const treeWidth = maxX - minX;
  const treeHeight = maxY - minY;

  // Make the SVG large enough for the entire tree
  const width = Math.max(treeContainer.clientWidth, treeWidth + PADDING * 2);
  const height = Math.max(treeContainer.clientHeight, treeHeight + PADDING * 2);

  tree.setAttribute("width", width);
  tree.setAttribute("height", height);

  // Center the entire tree inside the SVG
  const offsetX = (width - treeWidth) / 2 - minX;
  const offsetY = (height - treeHeight) / 2 - minY;

  // Draw branches first
  allNodes.forEach(node => {
    if (node.parent !== null) {
      drawBranch(node, offsetX, offsetY);
    }

    // Lines to existing nodes that were reused instead of creating overlaps
    if (node.links) {
      node.links.forEach(link => {
        const target = nodes[link.id];

        if (target) {
          drawLine(node, target, offsetX, offsetY);
        }
      });
    }
  });

  // Draw photos second
  allNodes.forEach(node => {
    drawNode(node, offsetX, offsetY);
  });
}

// --------------------------------------
// DRAW ONE LINE BETWEEN TWO NODES
// --------------------------------------

function drawLine(from, to, offsetX, offsetY) {

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

  line.setAttribute("x1", from.x + offsetX);
  line.setAttribute("y1", from.y + offsetY);
  line.setAttribute("x2", to.x + offsetX);
  line.setAttribute("y2", to.y + offsetY);
  line.setAttribute("class", "branch");

  tree.appendChild(line);
}

// --------------------------------------
// DRAW ONE BRANCH
// --------------------------------------

function drawBranch(node, offsetX, offsetY) {

  const parent = nodes[node.parent];

  // Skip if the parent isn't loaded (or was deleted)
  if (!parent) {
    return;
  }

  drawLine(parent, node, offsetX, offsetY);
}

// --------------------------------------
// DRAW ONE NODE, OR DISPLAY ZOOMEDCONTAINER
// --------------------------------------

function drawNode(node, offsetX, offsetY) {

  const image = document.createElementNS("http://www.w3.org/2000/svg", "image");

  // Position the image around its center
  image.setAttribute("x", node.x + offsetX - NODE_SIZE / 2);
  image.setAttribute("y", node.y + offsetY - NODE_SIZE / 2);
  image.setAttribute("width", NODE_SIZE);
  image.setAttribute("height", NODE_SIZE);

  // Show the uploaded photo, or the placeholder if there isn't one
  image.setAttribute("href", node.image || PLACEHOLDER);
  image.setAttribute("class", node.image ? "node-image" : "node-image empty");
  image.setAttribute("data-id", node.id);

  // Empty nodes can be clicked to upload a photo
  image.addEventListener("click", function () {
    if (loggedIn && !node.image) {
      selectedNode = node;
      fileInput.click();
    } else if (node.image) {
      // Show the preview of the clicked image
      highlight.src = node.image;
      zoomedContainer.style.display = "block";
      treeContainer.style.display = "none";
      zoomedNode = node;
        

  }
});

  tree.appendChild(image);
}

let parentNode;
let rightChild;
let leftChild;

// --------------------------------------
// EXIT ZOOMEDCONTAINER
// --------------------------------------

function closeViewer() {
  zoomedContainer.style.display = "none";
  emojiPicker.style.display = "none";
  treeContainer.style.display = "block";   
  drawTree();                          

  if (zoomedNode) {
    const shown = tree.querySelector('[data-id="' + zoomedNode.id + '"]');
    if (shown) {
      shown.scrollIntoView({ block: "center", inline: "center" });
    }
  }
}

exit.addEventListener("click", closeViewer);

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && zoomedContainer.style.display === "block") {
    closeViewer();
  }
});

// --------------------------------------
// GO UP NODES
// --------------------------------------

// Checks if there is a parent of a parent node, if there isn't, displays missingno.
function upArrowVisibility() {
  if (!zoomedNode) return null;

  let upNode;

  if (zoomedNode.isRoot) {
    upNode = findChild(zoomedNode, 270);   // the root's "up" goes to its child at 270 degrees
  } else {
    upNode = nodes[zoomedNode.parent];
  }

  if (upNode && upNode.image) {
    // Somewhere to go, and it has a photo: show the normal arrow
    mnUpArrow.style.display = "none";
    upArrow.style.display = "block";
    return upNode;
  } else {
    // Nothing there, or no photo yet: show the "missing" arrow
    mnUpArrow.style.display = "block";
    upArrow.style.display = "none";
    return null;
  }
}

function upImage(){
  const upNode = upArrowVisibility();
  if (upNode) {
    highlight.src = upNode.image;
    zoomedNode = upNode;
  }
}

upArrow.addEventListener("click", function () {
  upImage();
});

/* NWDBS
document.addEventListener('keydown', (event) => {
  if(event.key === "ArrowUp" && zoomedContainer.style.display === "block"){
    upImage();
  }
    
});
*/

// --------------------------------------
// FIND CHILD NODE AT A GIVEN ANGLE & PARENT
// --------------------------------------

function findChild(parentNode, angle) {
  if (!parentNode) return null;   // nothing to search from

  for (const id in nodes) {
    const n = nodes[id];
    if (n.parent === parentNode.id && n.angle === angle) {
      return n;   // found it
    }
  }

  // A spot that was linked to an existing node instead of getting a new one
  if (parentNode.links) {
    for (const link of parentNode.links) {
      if (link.angle === angle && nodes[link.id]) {
        return nodes[link.id];
      }
    }
  }

  return null;    // no child at that angle
}

// --------------------------------------
// FIND ALL PARENTS OF A NODE
// --------------------------------------

// Its own parent first, then any node that linked to it
function getParents(node) {
  const parents = [];

  if (node.parent !== null && nodes[node.parent]) {
    parents.push(nodes[node.parent]);
  }

  for (const id in nodes) {
    const n = nodes[id];

    if (n.links) {
      n.links.forEach(link => {
        if (link.id === node.id && !parents.includes(n)) {
          parents.push(n);
        }
      });
    }
  }
  return parents;
}

// True if `other` is a child of `node`: grown from it, or linked to by it
function isChild(other, node) {
  if (other.parent === node.id) {
    return true;
  }

  if (node.links) {
    return node.links.some(link => link.id === other.id);
  }

  return false;
}

// --------------------------------------
// GO UP NODES (one arrow for one parent, two arrows for two parents)
// --------------------------------------

// Sometimes the child neglects its parent (parent registers its child, but the child doesn't), 
// Forcefully make sure that they connect both ways properly
const HIDE_LOOP_BACK_ARROWS = false;

// The nodes the up arrows can lead to (only ones that have photos)
function getUpNodes() {
  if (!zoomedNode) return [];

  // The root's "up" goes to its child at 270 degrees, so it must not be filtered out as a child
  if (zoomedNode.isRoot) {
    const above = findChild(zoomedNode, 270);

    if (above && above.image) {
      return [above];
    }
    return [];
  }

  // Everyone else: any node that considers this one its child is a parent
  let parents = getParents(zoomedNode).filter(n => n.image);

  if (HIDE_LOOP_BACK_ARROWS) {
    parents = parents.filter(n => !isChild(n, zoomedNode));
  }

  return parents;
}

// Moves an up arrow to upLeft, upCenter, or upRight by switching its CSS class
function placeUpArrow(arrow, position) {
  arrow.classList.remove("upLeft", "upCenter", "upRight");
  arrow.classList.add(position);
}

// Shows the right arrows in the right places, and returns where each one leads
function updateUpArrows() {
  if (!zoomedNode) return { first: null, second: null };

  const upNodes = getUpNodes();

  // Nowhere to go up: mn
  if (upNodes.length === 0) {
    mnUpArrow.style.display = "block";
    upArrow.style.display = "none";
    upSecondArrow.style.display = "none";
    return { first: null, second: null };
  }

  mnUpArrow.style.display = "none";
  upArrow.style.display = "block";

  // One parent: a single arrow in the original centered spot
  if (upNodes.length === 1) {
    placeUpArrow(upArrow, "upCenter");
    upSecondArrow.style.display = "none";
    return { first: upNodes[0], second: null };
  }

  // Two parents: the parent that is further left gets the left arrow
  upSecondArrow.style.display = "block";

  if (upNodes[0].x <= upNodes[1].x) {
    placeUpArrow(upArrow, "upLeft");
    placeUpArrow(upSecondArrow, "upRight");
  } else {
    placeUpArrow(upArrow, "upRight");
    placeUpArrow(upSecondArrow, "upLeft");
  }

  return { first: upNodes[0], second: upNodes[1] };
}

function upImage(){
  const upNode = updateUpArrows().first;
  if (upNode) {
    highlight.src = upNode.image;
    zoomedNode = upNode;
  }
}

function upSecondImage(){
  const secondNode = updateUpArrows().second;
  if (secondNode) {
    highlight.src = secondNode.image;
    zoomedNode = secondNode;
  }
}

upSecondArrow.addEventListener("click", function () {
  upSecondImage();
});

/* NWDBS dear Camelia
document.addEventListener('keydown', (event) => {
  if(event.key === "ArrowUp" && zoomedContainer.style.display === "block"){
    upImage();
  }
    
});
*/

// --------------------------------------
// GO DOWN RIGHT NODES
// --------------------------------------

// Checks if there is a parent of a parent node, if there isn't, displays missingno.
function downRightArrowVisibility() {
  if (!zoomedNode) return;   // nothing is open, so there's nothing to update

  rightChild = findChild(zoomedNode, zoomedNode.angle - 30);

  if (zoomedNode.isRoot){
    mnDownRightArrow.style.display = "none";
    downRightArrow.style.display = "none";   
    return;
  }

  if(rightChild && leftChild == rightChild){
    mnDownRightArrow.style.display = "none";
    downRightArrow.style.display = "block";  
    downRightArrow.id = "duettingSolo";
    mnDownLeftArrow.style.display = "none";
    downLeftArrow.style.display = "none";  
  } else {
    downRightArrow.id = "downRightArrow";
  }

  if (!rightChild || !rightChild.image){
    mnDownRightArrow.style.display = "block";
    downRightArrow.style.display = "none";
  } 
    else {
    mnDownRightArrow.style.display = "none";
    downRightArrow.style.display = "block";
  }
}

function downRightImage(){
  downRightArrowVisibility();
  if (rightChild && rightChild.image){
    highlight.src = rightChild.image;
    zoomedNode = rightChild;
  }
}

downRightArrow.addEventListener("click", function () {
  downRightImage();
});

/* NWDBS dear Camelia
document.addEventListener('keydown', (event) => {
    if(event.key === "ArrowRight" && zoomedContainer.style.display === "block"){
    downRightImage();
  }
});
*/

// --------------------------------------
// GO DOWN LEFT NODES
// --------------------------------------

// Checks if there is a parent of a parent node, if there isn't, displays missingno.
function downLeftArrowVisibility() {
  if (!zoomedNode) return;   // nothing is open, so there's nothing to update

  leftChild = findChild(zoomedNode, zoomedNode.angle + 30);

  if (zoomedNode.isRoot){
    mnDownLeftArrow.style.display = "none";
    downLeftArrow.style.display = "none";   
    return;
  }

  if (!leftChild || !leftChild.image){
    mnDownLeftArrow.style.display = "block";
    downLeftArrow.style.display = "none";
  }  else {
    mnDownLeftArrow.style.display = "none";
    downLeftArrow.style.display = "block";
  }
}

function downLeftImage(){
  downLeftArrowVisibility();
  if (leftChild && leftChild.image){
    highlight.src = leftChild.image;
    zoomedNode = leftChild;
  }
}

downLeftArrow.addEventListener("click", function () {
  downLeftImage();
});

// --------------------------------------
// GO DOWN A NODE 
// --------------------------------------

function downArrowVisibility() {
  if (!zoomedNode || !zoomedNode.isRoot) {
    downArrow.style.display = "none";
    mnDownArrow.style.display = "none";
    return null;
  }

  const downChild = findChild(zoomedNode, 90);

  if (downChild && downChild.image) {
    downArrow.style.display = "block";
    mnDownArrow.style.display = "none";
    return downChild;
  } else {
    downArrow.style.display = "none";
    mnDownArrow.style.display = "block";
    return null;
  }
}

function downImage(){
  const downChild = downArrowVisibility();
  if (downChild){
    highlight.src = downChild.image;
    zoomedNode = downChild;
  }
}

downArrow.addEventListener("click", function () {
  downImage();
});


// --------------------------------------
// GO RIGHT A NODE 
// --------------------------------------

function rightArrowVisibility() {
  if (!zoomedNode || !zoomedNode.isRoot) {
    rightArrow.style.display = "none";
    mnRightArrow.style.display = "none";
    return null;
  }

  const rightChild = findChild(zoomedNode, 0);

  if (rightChild && rightChild.image) {
    rightArrow.style.display = "block";
    mnRightArrow.style.display = "none";
    return rightChild;
  } else {
    rightArrow.style.display = "none";
    mnRightArrow.style.display = "block";
    return null;
  }
}

function rightImage(){
  const rightChild = rightArrowVisibility();
  if (rightChild){
    highlight.src = rightChild.image;
    zoomedNode = rightChild;
  }
}

rightArrow.addEventListener("click", function () {
  rightImage();
});

// --------------------------------------
// GO LEFT A NODE 
// --------------------------------------

function leftArrowVisibility() {
  if (!zoomedNode || !zoomedNode.isRoot) {
    leftArrow.style.display = "none";
    mnLeftArrow.style.display = "none";
    return null;
  }

  const leftChild = findChild(zoomedNode, 180);

  if (leftChild && leftChild.image) {
    leftArrow.style.display = "block";
    mnLeftArrow.style.display = "none";
    return leftChild;
  } else {
    leftArrow.style.display = "none";
    mnLeftArrow.style.display = "block";
    return null;
  }
}

function leftImage(){
  const leftChild = leftArrowVisibility();
  if (leftChild){
    highlight.src = leftChild.image;
    zoomedNode = leftChild;
  }
}

leftArrow.addEventListener("click", function () {
  leftImage();
});

// --------------------------------------
// EMOJI REACTIONS
// --------------------------------------

const MAX_REACTIONS = 6;   // Most different emojis one photo can have

const emojiPickerElement = document.querySelector("#emojiPicker emoji-picker");

// The plus button opens and closes the picker
addReaction.addEventListener("click", function () {
  if (emojiPicker.style.display === "block") {
    emojiPicker.style.display = "none";
  } else {
    emojiPicker.style.display = "block";
  }
});

// When someone picks any emoji
emojiPickerElement.addEventListener("emoji-click", function (event) {
  addEmoji(event.detail.unicode);
  emojiPicker.style.display = "none";
});

// Adds 1 to an emoji's count on the photo being viewed
function addEmoji(emoji) {
  if (!zoomedNode) return;

  const current = nodes[zoomedNode.id];
  if (!current) return;

  const reactions = current.reactions || {};

  // A photo can only hold MAX_REACTIONS different emojis
  if (!reactions[emoji] && Object.keys(reactions).length >= MAX_REACTIONS) {
    return;
  }

  // Update the screen right away so there's no waiting for Firebase
  current.reactions = reactions;
  current.reactions[emoji] = (reactions[emoji] || 0) + 1;
  renderReactions();

  // In test mode, nothing is sent to Firebase
  if (!USE_FIREBASE) {
    return;
  }

  nodesCollection().doc(current.id).update(
    new firebase.firestore.FieldPath("reactions", emoji),
    firebase.firestore.FieldValue.increment(1)
  ).catch(error => console.error("Could not save reaction:", error));
}

// Draws the emoji bar for the photo being viewed
function renderReactions() {
  reactionList.innerHTML = "";

  // Show the plus by default (an empty value goes back to the CSS default)
  addReaction.style.display = "";

  if (!zoomedNode) return;

  const current = nodes[zoomedNode.id];
  if (!current || !current.reactions) return;

  // Most popular first
  const emojis = Object.keys(current.reactions).sort(
    (a, b) => current.reactions[b] - current.reactions[a]
  );

  // Once the limit is reached, hide the plus and close the picker if it's open
  if (emojis.length >= MAX_REACTIONS) {
    addReaction.style.display = "none";
    emojiPicker.style.display = "none";
  }

  emojis.forEach(emoji => {
    const count = current.reactions[emoji];

    const button = document.createElement("button");
    button.className = "reaction";
    button.textContent = emoji;

    // Only show a number once there is more than one
    if (count > 1) {
      button.textContent = emoji + " " + count;
    }

    // Clicking an emoji that's already there adds to its count
    button.addEventListener("click", function () {
      addEmoji(emoji);
    });

    reactionList.appendChild(button);
  });
}


// --------------------------------------
// UPDATES VISIBILITY FOR ALL ARROWS AND EMOJIS BELOW 
// --------------------------------------


document.addEventListener('click', function(event) {  
    updateUpArrows();
    downArrowVisibility();
    rightArrowVisibility();
    leftArrowVisibility();
    downLeftArrowVisibility();
    downRightArrowVisibility(); 
    renderReactions();

    // Close the emoji picker when clicking anywhere else
    if (event.target !== addReaction && !emojiPicker.contains(event.target)) {
      emojiPicker.style.display = "none";
    }
});
  
// Is `node` somewhere below `ancestor` along the original parent chain?
function isDescendantOf(node, ancestor) {
  let current = node;

  while (current && current.parent !== null) {
    if (current.parent === ancestor.id) {
      return true;
    }
    current = nodes[current.parent];
  }
  return false;
}

// --------------------------------------
// PHOTO UPLOAD
// --------------------------------------

fileInput.addEventListener("change", function () {

  const file = fileInput.files[0];

  if (!file || !selectedNode) {
    return;
  }

  const node = selectedNode;
  selectedNode = null;
  fileInput.value = "";

  shrinkImage(file, dataUrl => addPhoto(node, dataUrl));
});

// Saves the photo AND creates its child branches in one step.
// If someone else filled this spot first, nothing happens.
async function addPhoto(node, dataUrl) {

  const ref = nodesCollection().doc(node.id);
  const plan = planChildren(node);

  // Test mode: update the in-memory tree instead of Firebase
  if (!USE_FIREBASE) {
    if (nodes[node.id].image) {
      return;   // already taken
    }

    nodes[node.id].image = dataUrl;
    nodes[node.id].links = plan.links;

    plan.children.forEach(child => {
      nodes[child.id] = child;
    });

    drawTree();
    return;
  }

  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);

      if (snap.data().image) {
        return; // already taken
      }

      // Save the photo, plus which spots reuse an existing node
      t.update(ref, { image: dataUrl, links: plan.links });

      plan.children.forEach(child => {
        t.set(nodesCollection().doc(child.id), child);
      });
    });
  } catch (error) {
    console.error("Could not save photo:", error);
    alert("Sorry, that photo could not be saved.");
  }
}

// --------------------------------------
// FIND A NODE THAT IS IN THE WAY
// --------------------------------------

// Distance from a point to the closest spot on a line segment
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  // How far along the segment the closest spot is (0 = start, 1 = end)
  let t = 0;
  if (lengthSquared > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
  }

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Every line currently drawn, as pairs of nodes
function getAllLines() {
  const lines = [];

  for (const id in nodes) {
    const n = nodes[id];

    if (n.parent !== null && nodes[n.parent]) {
      lines.push({ from: nodes[n.parent], to: n });
    }

    if (n.links) {
      n.links.forEach(link => {
        if (nodes[link.id]) {
          lines.push({ from: n, to: nodes[link.id] });
        }
      });
    }
  }
  return lines;
}

// Looks for an existing node that a new branch from parent to (x, y) would run into.
// Returns the one closest to the parent, or null if the way is clear.
function findBlockingNode(parent, x, y) {
  const candidates = [];

  // Nodes near the new spot, or sitting on the path to it
  for (const id in nodes) {
    const n = nodes[id];

    if (n.id === parent.id) {
      continue;
    }

    const nearSpot = Math.hypot(n.x - x, n.y - y) < MIN_NODE_GAP;
    const onPath = distanceToSegment(n.x, n.y, parent.x, parent.y, x, y) < LINE_CLEARANCE;

    if (nearSpot || onPath) {
      candidates.push(n);
    }
  }

  // Lines that the new spot would sit on: use the nodes at the ends of that line
  getAllLines().forEach(line => {
    if (distanceToSegment(x, y, line.from.x, line.from.y, line.to.x, line.to.y) < LINE_CLEARANCE) {
      if (line.from.id !== parent.id) {
        candidates.push(line.from);
      }
      if (line.to.id !== parent.id) {
        candidates.push(line.to);
      }
    }
  });

  // The node closest to the parent wins
  let closest = null;
  let closestDistance = Infinity;

  candidates.forEach(n => {
    const distance = Math.hypot(n.x - parent.x, n.y - parent.y);

    if (distance < closestDistance) {
      closest = n;
      closestDistance = distance;
    }
  });

  return closest;
}

// --------------------------------------
// PLAN CHILDREN (returns data, saving happens in addPhoto)
// --------------------------------------

// For each spot, either make a new node or link to an existing one that is too close
function planChildren(parent) {

  let angles;

  // The root photo gets four branches
  if (parent.isRoot) {
    angles = [0, 90, 180, 270];
  } else {
    // Every other photo gets two branches
    angles = [parent.angle - 30, parent.angle + 30];
  }

  const children = [];   // brand-new nodes to create
  const links = [];      // spots that reuse an existing node

  angles.forEach(angle => {
    const radians = angle * Math.PI / 180;
    const x = parent.x + Math.cos(radians) * DISTANCE;
    const y = parent.y + Math.sin(radians) * DISTANCE;

    const existing = findBlockingNode(parent, x, y);

    if (existing) {
      links.push({ angle: angle, id: existing.id });
    } else {
      children.push({
        id: nodesCollection().doc().id,
        x: x,
        y: y,
        angle: angle,
        parent: parent.id,
        isRoot: false,
        image: null
      });
    }
  });

  return { children: children, links: links };
}

// --------------------------------------
// HANDLE WINDOW RESIZING
// --------------------------------------

window.addEventListener("resize", drawTree);
window.addEventListener("load", drawTree);

// --------------------------------------
// TESTING ONLY: wipe the tree and start over
// --------------------------------------

// After logging in, type resetTree() in the browser console (F12).
// It deletes every node and leaves one empty placeholder in the center.
// ONLY FOR ME, DELETE.
async function resetTree() {
  if (USE_FIREBASE) {
    const snap = await nodesCollection().get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  Object.keys(nodes).forEach(id => delete nodes[id]);
  await createRoot();
}

// Test mode has no database to load a root from, so make one now
if (!USE_FIREBASE) {
  console.warn("TEST MODE: nothing is being saved to Firebase");
  createRoot();
}
