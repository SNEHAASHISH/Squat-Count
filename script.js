import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

let poseLandmarker;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Squat specific variables
let squatState = 'up';
let repCount = 0;

const createPoseLandmarker = async () => {
    console.log("Initializing PoseLandmarker...");
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numPoses: 2
    });
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", (event) => {
        console.log("Button clicked!");
        enableCam(event);
    });
    console.log("PoseLandmarker Initialized.");
};

const enableCam = (event) => {
    console.log("Enable Camera clicked...");
    if (!poseLandmarker) {
        console.warn("Wait! poseLandmaker not loaded yet.");
        return;
    }

    if (webcamRunning) {
        console.log("Disabling Webcam...");
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE WEBCAM";
    } else {
        console.log("Enabling Webcam...");
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE WEBCAM";
    }

    const constraints = {
        video: true
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        const video = document.getElementById("webcam");
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    }).catch(error => {
        console.error("Error accessing webcam:", error);
    });
};

const predictWebcam = () => {
    console.log("Predicting...");
    const video = document.getElementById("webcam");
    const canvasElement = document.getElementById("output_canvas");
    const canvasCtx = canvasElement.getContext("2d");
    const drawingUtils = new DrawingUtils(canvasCtx);

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        poseLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    let startTimeMs = performance.now();
    poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        for (const landmark of result.landmarks) {
            const hipAngle = calculateAngle(landmark[24], landmark[23], landmark[25]);
            const kneeAngle = calculateAngle(landmark[24], landmark[25], landmark[26]);
            const inSquat = checkSquatDepth(hipAngle, kneeAngle);

            const connectorColor = inSquat ? 'green' : undefined;
            
            drawingUtils.drawLandmarks(landmark, {
                radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
            });
            drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: connectorColor});
        }
        canvasCtx.restore();
    });

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
};

function calculateAngle(a, b, c) {
    const vec1 = [b.x - a.x, b.y - a.y];
    const vec2 = [b.x - c.x, b.y - c.y];

    const dotProduct = vec1[0] * vec2[0] + vec1[1] * vec2[1];
    const lenVec1 = Math.sqrt(vec1[0] ** 2 + vec1[1] ** 2);
    const lenVec2 = Math.sqrt(vec2[0] ** 2 + vec2[1] ** 2);

    const angle = Math.acos(dotProduct / (lenVec1 * lenVec2));
    return angle * (180 / Math.PI);
}

function checkSquatDepth(hipAngle, kneeAngle) {
    if (squatState === 'up' && hipAngle > 160 && kneeAngle > 160) {
        return false; // Still standing up
    } else if (squatState === 'up' && hipAngle < 90 && kneeAngle < 130) {
        squatState = 'down';
        console.log("Squat Down Detected!");
        return true; // Squat down
    } else if (squatState === 'down' && hipAngle > 160 && kneeAngle > 160) {
        squatState = 'up';
        repCount += 1;
        console.log(`Squat Up Detected! Total Reps: ${repCount}`);
        document.getElementById('squatCount').innerText = `Reps: ${repCount}`;
        return false; // Completed squat and standing up
    } else if (squatState === 'down') {
        return true; // Still in squat position
    }
    return false;
}

// Initialize the poseLandmarker
createPoseLandmarker();