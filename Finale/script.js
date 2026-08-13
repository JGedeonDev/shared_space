// --------------------------------------
// GET THE HTML ELEMENTS
// --------------------------------------

const container = document.getElementById("treeContainer");
const tree = document.getElementById("tree");
const fileInput = document.getElementById("fileInput");
const mainStar = document.querySelector(".mainStar");
const password = document.getElementById("password");
const username = document.getElementById("username");
const login = document.querySelector(".login");
const homeContainer = document.querySelector(".homeContainer");


// --------------------------------------
// SETTINGS
// --------------------------------------

// Change these to change the tree's appearance.
const NODE_SIZE = 100; // Size of each photo
const DISTANCE = 300; // Distance between nodes
const PADDING = 200; // Empty space around the tree




// --------------------------------------
// TREE DATA
// --------------------------------------

// Every photo/node is stored here.
const nodes = {};

// Used to give each node a unique ID.
let nextId = 0;

// Remembers which empty node the user clicked.
let selectedNode = null;

// --------------------------------------
// CREATE THE ROOT NODE
// --------------------------------------

mainStar.addEventListener("click", (event) => {
  if(username.value == "" &&
    password.value == ""){
    login.style.display = "block" ;
    console.log(username.value, password.value)
  } else {
    homeContainer.style.display = "none";
    const root = createNode(
    container.clientWidth / 2,
    container.clientHeight / 2,
    null,
    null,
    true
    );
  }
}); 
  



// --------------------------------------
// CREATE A NODE
// --------------------------------------

function createNode(x, y, angle, parent, isRoot) {

const id = "node" + nextId++;

nodes[id] = {
    id: id,
    x: x,
    y: y,
    angle: angle,
    parent: parent,
    isRoot: isRoot,
    image: null
};

drawTree();

return nodes[id];

}

// --------------------------------------
// DRAW THE WHOLE TREE
// --------------------------------------

function drawTree() {

    // Remove the old drawing.
    tree.innerHTML = "";

    const allNodes = Object.values(nodes);

    if (allNodes.length === 0) {
        return;
    }

    // Find how large the tree is.
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

    // Size of the actual tree.
    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;

    // Make the SVG large enough for the entire tree.
    const width = Math.max(
        container.clientWidth,
        treeWidth + PADDING * 2
    );

    const height = Math.max(
        container.clientHeight,
        treeHeight + PADDING * 2
    );

    tree.setAttribute("width", width);
    tree.setAttribute("height", height);

    // CENTER the entire tree inside the SVG.
    const offsetX = (width - treeWidth) / 2 - minX;
    const offsetY = (height - treeHeight) / 2 - minY;

    // Draw branches first.
    allNodes.forEach(node => {

        if (node.parent === null) {
            return;
        }

        drawBranch(node, offsetX, offsetY);

    });

    // Draw photos second.
    allNodes.forEach(node => {

        drawNode(node, offsetX, offsetY);

    });

}

// --------------------------------------
// DRAW ONE BRANCH
// --------------------------------------

function drawBranch(node, offsetX, offsetY) {

const parent = nodes[node.parent];

const line = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "line"
);

line.setAttribute(
    "x1",
    parent.x + offsetX
);

line.setAttribute(
    "y1",
    parent.y + offsetY
);

line.setAttribute(
    "x2",
    node.x + offsetX
);

line.setAttribute(
    "y2",
    node.y + offsetY
);

line.setAttribute("class", "branch");

tree.appendChild(line);

}

// --------------------------------------
// DRAW ONE NODE
// --------------------------------------

function drawNode(node, offsetX, offsetY) {

const image = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "image"
);


// Position the image around its center.
image.setAttribute(
    "x",
    node.x + offsetX - NODE_SIZE / 2
);

image.setAttribute(
    "y",
    node.y + offsetY - NODE_SIZE / 2
);

image.setAttribute("width", NODE_SIZE);
image.setAttribute("height", NODE_SIZE);


// Show the uploaded photo.
// If there is no photo, show the placeholder.
image.setAttribute(
    "href",
    node.image || "placeholder.svg"
);


image.setAttribute(
    "class",
    node.image
        ? "node-image"
        : "node-image empty"
);


// Empty nodes can be clicked to upload a photo.
image.addEventListener("click", function() {

    if (node.image === null) {

        selectedNode = node;

        fileInput.click();
    }
});


tree.appendChild(image);

}

// --------------------------------------
// PHOTO UPLOAD
// --------------------------------------

fileInput.addEventListener("change", function() {

const file = fileInput.files[0];

// Stop if no photo was selected.
if (!file || !selectedNode) {
    return;
}


// Create a temporary URL for the photo.
selectedNode.image = URL.createObjectURL(file);


// Create new branches from this photo.
createChildren(selectedNode);


// Reset the file picker.
fileInput.value = "";

selectedNode = null;


// Redraw the tree.
drawTree();

});

// --------------------------------------
// CREATE CHILDREN
// --------------------------------------

function createChildren(parent) {

// The first/root photo gets four branches.
if (parent.isRoot) {

    createChild(parent, 0);
    createChild(parent, 90);
    createChild(parent, 180);
    createChild(parent, 270);
    return;
}


// Every other photo gets two branches.
createChild(
    parent,
    parent.angle - 30
);

createChild(
    parent,
    parent.angle + 30
);

}

// --------------------------------------
// CREATE ONE CHILD
// --------------------------------------

function createChild(parent, angle) {

// Convert degrees to radians.
const radians = angle * Math.PI / 180;


// Calculate the child's position.
const x =
    parent.x + Math.cos(radians) * DISTANCE;

const y =
    parent.y + Math.sin(radians) * DISTANCE;


// Create the new node.
createNode(
    x,
    y,
    angle,
    parent.id,
    false
);

}

// --------------------------------------
// HANDLE WINDOW RESIZING
// --------------------------------------

window.addEventListener("resize", function() {

drawTree();

});

window.addEventListener('load', () => {
  drawTree();
});