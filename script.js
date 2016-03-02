////////////////////////////////////////////////////////////////////////
// Boxes
//

function mm(inches) {
    return Math.floor(inches * 25.4);
}


var Boxes = [
    {name: 'Paige 15', width: mm(12), depth: mm(15), height: mm(10)},
    {name: 'Archival Legal', width: mm(5), height: mm(10.25), depth: mm(15.25)},
    {name: 'Archive Half Legal', width: mm(2.5), height: mm(10.25), depth: mm(15.25)},
    {name: 'Flat Box', width: mm(15), height: mm(3), depth: mm(18.5)},
    {name: 'CD ', width: mm(0.4), height: mm(4.92), depth: mm(5.59), pile_options: { maxTowerCount: 1 }},
    {name: 'DVD ', width: mm(0.55), height: mm(7.6), depth: mm(5.4), pile_options: { maxTowerCount: 1 }}
];


////////////////////////////////////////////////////////////////////////
// Utils
//

var Utils = {}

Utils.choose_one = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

Utils.object_merge = function () {
    var result = {}

    Array.prototype.slice.call(arguments).forEach(function (obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            }
        }
    });

    return result;
};




////////////////////////////////////////////////////////////////////////
// Packing logic
//

function Box(name, dimensions) {
    this.name = name;
    this.dimensions = dimensions;

    this.bottomLeftBackCornerX = 0;
    this.bottomLeftBackCornerY = 0;
    this.bottomLeftBackCornerZ = 0;
};

// Add notion of pileability?
function Pile(shelfDimensions, options) {
    this.shelfDimensions = shelfDimensions;
    this.boxes = [];
    this.options = options;
};

Pile.prototype.add = function (box) {
    this.boxes.push(box);
};

Pile.prototype.width = function () {
    return this.boxes[0].dimensions.width;
};

Pile.prototype.boxesPerTower = function () {
    return this.options.maxTowerCount || Math.floor(this.shelfDimensions.height / this.boxes[0].dimensions.height);
};

Pile.prototype.maxBoxCount = function () {
    var numberOfTowers = Math.floor(this.shelfDimensions.depth / this.boxes[0].dimensions.depth);

    return (this.boxesPerTower() * numberOfTowers);
}

Pile.prototype.will_fit = function (box) {
    // If it's the wrong type, it doesn't fit
    if ((this.boxes.length > 0) && this.boxes[0].name !== box.name) {
        return false;
    }

    return (this.boxes.length < this.maxBoxCount());
};

Pile.prototype.height = function () {
    var result = 0;
    this.boxes.forEach(function (box) {
        result += box.dimensions.height;
    });

    return result;
};

function BoxPacker(shelfDimensions) {
    this.piles = [];

    this.shelfDimensions = shelfDimensions;
};

BoxPacker.prototype.findPileForBox = function (box) {
    var result = false;
    this.piles.some(function (pile) {
        if (pile.will_fit(box)) {
            result = pile;
            return true;
        }
    });

    return result;
}

BoxPacker.prototype.pile_fits = function (pile) {
    var pileWidths = 0;
    this.piles.forEach(function (pile) {
        pileWidths += pile.width();
    });

    return ((pileWidths + pile.width()) <= this.shelfDimensions.width);
};

BoxPacker.prototype.addBox = function (name, dimensions) {
    if ((dimensions.depth > this.shelfDimensions.depth) ||
        (dimensions.height > this.shelfDimensions.height) ||
        (dimensions.width > this.shelfDimensions.width)) {
        console.log("Box is larger than shelf!");
        return false;
    }


    var box = new Box(name, dimensions);

    var pile = this.findPileForBox(box);

    if (pile) {
        pile.add(box);
    } else {
        // New pile if one will fit on the shelf
        var pile = new Pile(this.shelfDimensions, dimensions.pile_options || {});
        pile.add(box);

        if (this.pile_fits(pile)) {
            this.piles.push(pile);
        } else {
            console.log("Out of space while placing box!");
            return false;
        }
    }
};

BoxPacker.prototype.each = function (callback) {
    var self = this;
    var xPosition = 0;

    this.piles.forEach(function (pile) {
        var zPosition = 0;
        var yPosition = 0;

        pile.boxes.forEach(function (box) {
            if ((yPosition + box.dimensions.height) > Math.min(self.shelfDimensions.height, (pile.boxesPerTower() * box.dimensions.height))) {
                yPosition = 0;
                // z position should never overflow the shelf because the pile would stop it
                // minus?
                zPosition += box.dimensions.depth;
            }

            // Translate each box from corner origin to centre origin
            callback(box.dimensions,
                     [
                         xPosition - (self.shelfDimensions.width / 2) + (box.dimensions.width / 2),
                         yPosition - (self.shelfDimensions.height / 2) + (box.dimensions.height / 2),
                         zPosition - (self.shelfDimensions.depth / 2) + (box.dimensions.depth / 2),
                     ]);

            yPosition += box.dimensions.height;

        });

        xPosition += pile.width();
    });
};

////////////////////////////////////////////////////////////////////////
// Renderer
//
(function () {
    var shelfDimensions, packer;
    var camera, scene, renderer;
    var meshes = [];

    var rotateSpeed = 0.005;

    var texture_loader = new THREE.TextureLoader();

    var texture_files = ['cardboard.jpg', 'red.jpg', 'blue.jpg', 'paper.jpg', 'litter.jpg', 'orange.jpg', 'grey.jpg'];
    var textures = [];

    texture_files.forEach(function (file) {
        textures.push(texture_loader.load(file));
    });

    function shelf(opts) {
        var mesh = new THREE.Mesh(new THREE.BoxGeometry(opts.width, opts.height, opts.depth),
                                  new THREE.MeshBasicMaterial({ opacity: 0 }));
        meshes.push(mesh);

        return [mesh, new THREE.EdgesHelper(mesh, 0xffffff)];
    }

    function texture_for(opts) {
        var index = Math.floor((opts.width + opts.height + opts.depth) % textures.length);

        return textures[index];
    }

    function box(opts) {
        var mesh = new THREE.Mesh(new THREE.BoxGeometry(opts.width, opts.height, opts.depth),
                                  new THREE.MeshBasicMaterial({ map: texture_for(opts) }));

        if (opts.position) {
            mesh.position.set.apply(mesh.position, opts.position);
        }

        meshes.push(mesh);
        return [mesh];
    }

    function init() {
        shelfDimensions = {width: (1003 * 2), height: (266 * 3), depth: 500};
        packer = new BoxPacker(shelfDimensions);

        var i;
        for (i = 0; i < 10; i++) {
            var randomBox = Utils.choose_one(Boxes)
            packer.addBox(randomBox.name, randomBox);
        }

        renderScene();
    }

    function renderScene() {
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 4000);
        camera.position.set(0, 0, 1400);
        camera.lookAt(scene.position);
        camera.updateProjectionMatrix();

        renderer = new THREE.CanvasRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight - 50);

        scene_meshes = []
        scene_meshes = scene_meshes.concat(shelf(shelfDimensions));

        packer.each(function (dimensions, position) {
            var params = Utils.object_merge(dimensions, {position: position});
            scene_meshes = scene_meshes.concat(box(params));
        });

        scene_meshes.forEach(function (mesh) {
            scene.add(mesh);
        });

        var root = document.getElementById('drawing');
        root.innerHTML = '';
        root.appendChild(renderer.domElement);

        clickdrag(root);
    }


    function clickdrag(root) {
        var mouseDown = false;
        var threshold = 5;
        var lastReadTime = 0;
        var lastXPos = 0;

        root.addEventListener('mousedown', function (e) {
            mouseDown = true;
            lastXPos = e.pageX;
            lastReadTime = new Date().getTime();
        });

        root.addEventListener('mousemove', function (e) {
            if (mouseDown) {
                var now = new Date().getTime();

                if ((now - lastReadTime) > threshold) {
                    var pixels_per_ms = (e.pageX - lastXPos) / ((now - lastReadTime) * 1.0);

                    lastXPos = e.pageX;
                    lastReadTime = now;

                    rotateSpeed = pixels_per_ms / 2.0;
                }
            }
        });

        root.addEventListener('mouseup', function () {
            mouseDown = false;
        });
    }

    function animate() {
        requestAnimationFrame(animate);

        var x = camera.position.x;
        var y = camera.position.y;
        var z = camera.position.z;

        camera.position.y = 500;
        camera.position.x = x * Math.cos(rotateSpeed) + z * Math.sin(rotateSpeed);
        camera.position.z = z * Math.cos(rotateSpeed) - x * Math.sin(rotateSpeed)

        camera.lookAt(scene.position);
        camera.updateProjectionMatrix();

        renderer.render(scene, camera);
    }

    init();
    animate();

    document.getElementById('addBox').addEventListener('click', function () {
        var randomBox = Utils.choose_one(Boxes)
        packer.addBox(randomBox.name, randomBox);
        renderScene();
    });


}());
