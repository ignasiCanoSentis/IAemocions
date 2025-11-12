import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

// Definim les dimensions del vídeo
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

// Traduccions de les expressions
const expressionTranslations = {
    neutral: 'Neutral',
    happy: 'Feliç 😊',
    sad: 'Trist 😢',
    angry: 'Enfadat 😠',
    fearful: 'Espantat 😨',
    disgusted: 'Disgustat 😖',
    surprised: 'Sorpren 😮',
};

// Colors per a cada emoció
const emotionColors = {
    neutral: {
        background: 'linear-gradient(135deg, #2b2d35ff 0%, #000000ff 100%)',
        barColor: '#111218ff'
    },
    happy: {
        background: 'linear-gradient(135deg, #f6c31bff 0%, #ffff00ff 100%)',
        barColor: '#c3ff00ff'
    },
    sad: {
        background: 'linear-gradient(135deg, #1707ffff 0%, #1152aeff 100%)',
        barColor: '#072043ff'
    },
    angry: {
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5aff 100%)',
        barColor: '#ff6b6b'
    },
    fearful: {
        background: 'linear-gradient(135deg, #c471f5 0%, #902d6fff 100%)',
        barColor: '#c471f5'
    },
    disgusted: {
        background: 'linear-gradient(135deg, #0e9d37ff 0%, #4df200ff 100%)',
        barColor: '#56ab2f'
    },
    surprised: {
        background: 'linear-gradient(135deg, #ff9500ff 0%, #ffcc00ff 100%)',
        barColor: '#ff4000ff'
    }
};

const ExpressionDetector = () => {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [detectedExpression, setDetectedExpression] = useState('Detectant...');
    const [currentEmotion, setCurrentEmotion] = useState('neutral');
    const [emotionConfidence, setEmotionConfidence] = useState(0);

    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const intervalRef = useRef(null); // Ref per guardar l'ID de l'interval
    const containerRef = useRef(null); // Ref per al contenidor principal

    // PAS A: Carregar els models d'IA
    useEffect(() => {
        const loadModels = async () => {
            // Els models estan a la carpeta /public/models
            const MODEL_URL = '/models';

            console.log('Carregant models...');
            try {
                await Promise.all([
                    // Model lleuger per detectar rostres ràpidament
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    // Model per detectar els 68 punts facials (ulls, nas, boca)
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    // Model per reconèixer l'expressió
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                console.log('Models carregats correctament.');
            } catch (error) {
                console.error('Error carregant els models:', error);
            }
        };
        loadModels();

        // Neteja: aturar l'interval quan el component es desmunta
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // PAS B: Funció per iniciar la detecció
    const startDetection = () => {
        console.log('Iniciant detecció...');

        intervalRef.current = setInterval(async () => {
            if (webcamRef.current && 
                webcamRef.current.video && 
                canvasRef.current && 
                modelsLoaded) {

                // 1. Obtenir el vídeo de la webcam
                const video = webcamRef.current.video;

                // 2. Crear un canvas a partir del vídeo (per dibuixar-hi a sobre)
                const canvas = canvasRef.current;
                const displaySize = { 
                    width: VIDEO_WIDTH, 
                    height: VIDEO_HEIGHT 
                };
                faceapi.matchDimensions(canvas, displaySize);

                // 3. Executar la detecció
                // .withFaceLandmarks() per als punts
                // .withFaceExpressions() per a les emocions
                const detections = await faceapi
                    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceExpressions();

                // 4. Processar els resultats
                if (detections.length > 0) {
                    // Agafem la primera cara detectada
                    const expressions = detections[0].expressions;

                    // Trobem l'expressió dominant (la que té més probabilitat)
                    const dominantExpression = Object.keys(expressions).reduce((a, b) => 
                        expressions[a] > expressions[b] ? a : b
                    );
                    
                    // Obtenim la confiança (probabilitat) de l'emoció dominant
                    const confidence = Math.round(expressions[dominantExpression] * 100);
                    
                    // Actualitzem l'estat amb la traducció
                    setDetectedExpression(
                        expressionTranslations[dominantExpression] || dominantExpression
                    );
                    setCurrentEmotion(dominantExpression);
                    setEmotionConfidence(confidence);
                    
                    // Aplicar el color de fons segons l'emoció
                    if (containerRef.current) {
                        containerRef.current.style.background = emotionColors[dominantExpression]?.background || emotionColors.neutral.background;
                    }

                    // 5. Dibuixar les deteccions al canvas (opcional, però útil per a RA2)
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);
                    const context = canvas.getContext('2d');
                    context.clearRect(0, 0, canvas.width, canvas.height); // Netejar canvas

                    // Dibuixa el requadre de la cara
                    faceapi.draw.drawDetections(canvas, resizedDetections);

                    // Dibuixa les expressions (text i probabilitat)
                    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
                    
                    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

                } else {
                    setDetectedExpression('Sense rostre detectat');
                    // Netejar el canvas si no hi ha deteccions
                    const context = canvas.getContext('2d');
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }
            }
        }, 500); // Executa la detecció cada 500ms
    };

    // PAS C: Funció que s'activa quan la càmera està llesta
    const handleVideoOnPlay = () => {
        // Un cop la càmera funciona, comencem la detecció
        startDetection();
    };

    // PAS D: Renderitzar el component
    return (
        <div 
            ref={containerRef}
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                minHeight: '100vh',
                padding: '40px',
                background: emotionColors.neutral.background,
                transition: 'background 0.8s ease-in-out'
            }}
        >
            <h2>Detector d'Estat d'Ànim (RA2)</h2>
            {!modelsLoaded ? (
                <p>Carregant models d'IA, si us plau, espereu...</p>
            ) : (
                <p>Models Carregats!</p>
            )}

            {/* Contenidor per superposar webcam i canvas */}
            <div style={{ 
                position: 'relative', 
                width: VIDEO_WIDTH, 
                height: VIDEO_HEIGHT 
            }}>
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    width={VIDEO_WIDTH}
                    height={VIDEO_HEIGHT}
                    videoConstraints={{ 
                        width: VIDEO_WIDTH, 
                        height: VIDEO_HEIGHT, 
                        facingMode: 'user' 
                    }}
                    onUserMedia={handleVideoOnPlay} // Activa la detecció quan la càmera s'inicia
                    style={{ position: 'absolute', top: 0, left: 0 }}
                />
                <canvas
                    ref={canvasRef}
                    width={VIDEO_WIDTH}
                    height={VIDEO_HEIGHT}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                />
            </div>

            {modelsLoaded && (
                <>
                    <h3 style={{ marginTop: '20px', fontSize: '1.5em', color: '#fff' }}>
                        Estat d'ànim detectat: {detectedExpression}
                    </h3>
                    
                    {/* Barra de confiança */}
                    <div style={{
                        width: '300px',
                        height: '40px',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        marginTop: '20px',
                        position: 'relative',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${emotionConfidence}%`,
                            backgroundColor: emotionColors[currentEmotion]?.barColor || emotionColors.neutral.barColor,
                            transition: 'width 0.3s ease-out, background-color 0.3s ease',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '50px'
                        }}></div>
                        <span style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontWeight: 'bold',
                            fontSize: '1.1em',
                            color: '#fff',
                            textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                            zIndex: 10
                        }}>
                            {emotionConfidence}%
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default ExpressionDetector;