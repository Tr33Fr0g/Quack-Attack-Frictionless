//state
let detector = null;
let isCalibrated = false;
let baselineDistance = 0;
let isSlouching = false;
let slouchTimer = null;
let duckIsActive = false;

//config
const SLOUCH_THRESHOLD = 0.15;
const SLOUCH_DELAY_MS = 1500;
const MIN_CONFIDENCE = 0.3;

//ELEMENTS THING
const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const calibrateBtn = document.getElementById('calibrate-btn');
const statusText = document.getElementById('status');
const duckZone = document.getElementById('duck-zone');
const quackSound = document.getElementById('quack-sound');

//Duck pics

const duckImages = ['assets/duck1.png', 'assets/duck2.png', 'assets/duck3.png']

//START APP 

async function init() {
    await setupWebcam();
    await loadModel();
    detectPose();
}

//Webcam Setup
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video:  {width: 640, height:480 }
        });
        video.srcObject = stream;
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    } catch (error) {
        statusText.textContent = 'camera access was denied. Please change your settings and allow camera access and reload.';
        statusText.className = 'status-bad';
        throw error;
    }
}

//Load the movenet model
async function loadModel() {
    statusText.textContent = 'Loading the ai model.....'
    statusText.className = 'status-loading';

    detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
            modelType:
            poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }
    );

    statusText.textContent = 'Model was loaded! Click the Calibrate button when sitting up straight to start.';
    statusText.className = 'status-good';
    calibrateBtn.disabled = false;
}

//Pose detector looper
async function detectPose() {
    if (!detector) {
        requestAnimationFrame(detectPose);
        return;
    }

    const poses = await detector.estimatePoses(video);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (poses.length > 0) {
        const keypoints = poses[0].keypoints;
        const nose = keypoints[0];
        const leftShoulder = keypoints[5];
        const rightShoulder = keypoints[6];

        if (nose.score > MIN_CONFIDENCE &&
            leftShoulder.score > MIN_CONFIDENCE &&
            rightShoulder.score > MIN_CONFIDENCE) {
                drawKeypoints(nose, leftShoulder, rightShoulder);

                const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
                const currentDistance = shoulderMidY - nose.y;

                if (isCalibrated) {
                    checkPosture(currentDistance);
                }
            }
        
    }
    requestAnimationFrame(detectPose);
}

//Draw the keypoints
function drawKeypoints(nose, leftShoulder, rightShoulder) {
    const points = [nose, leftShoulder, rightShoulder];
    const color = isSlouching ? '#ff4444' : '#409443';

    points.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
});

ctx.beginPath();
ctx.moveTo(leftShoulder.x, leftShoulder.y);
ctx.lineTo(rightShoulder.x, rightShoulder.y);
ctx.strokeStyle = color;
ctx.lineWidth = 3;
ctx.stroke();
}
    //SLOUCH CHECKER 3000 UP AND RUNNING
function checkPosture(currentDistance) {
    const deviation = (baselineDistance - currentDistance) / baselineDistance;

    if (deviation > SLOUCH_THRESHOLD) {
        if (!isSlouching && !slouchTimer) {
            slouchTimer = setTimeout(() => {
                isSlouching = true;
                triggerDuckAttack();
            }, SLOUCH_DELAY_MS);
        }
    } else {
        if (slouchTimer) {
            clearTimeout(slouchTimer);
            slouchTimer = null;
        }
        if (isSlouching) {
            isSlouching = false;
            removeDuckAttack();
        }
    }
}

//Calibration for the slouching thingy mabob
calibrateBtn.addEventListener('click', () => {
    isCalibrated = false;

    const calibrate = async () => {
        const poses = await detector.estimatePoses(video);
        if (poses.length > 0) {
            const keypoints = poses[0].keypoints;
            const nose = keypoints[0];
            const leftShoulder = keypoints[5];
            const rightShoulder = keypoints[6];

            if (nose.score > MIN_CONFIDENCE &&
                leftShoulder.score > MIN_CONFIDENCE &&
                rightShoulder.score > MIN_CONFIDENCE) {
                    const shoulderMidY = (leftShoulder.y + rightShoulder.y) /2;

                    baselineDistance = shoulderMidY - nose.y;
                    isCalibrated = true;
                    
                    statusText.textContent = 'Website is calibrated! Watch your posture!!!'

                    statusText.className = 'status-good';
                    calibrateBtn.textContent = 'Re-Calibrate';
                } else {
                    statusText.textContent = 'Could not detect your pose. Please make sure your head and both shoulders are visible on your camera.';
                    statusText.className = 'status-bad';
                }
        }
    };
    calibrate();
});

init();