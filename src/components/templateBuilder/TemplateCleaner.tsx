"use client";

import { useState, useRef } from "react";
import { useGeminiStore } from "../../stores/geminiStore";

interface TemplateCleanerProps {
  onCleanedImage: (frontBase64: string, backBase64: string | null) => void;
}

interface CleaningResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
}

/**
 * TemplateCleaner - Removes all text and values from a voucher image using Gemini
 *
 * This is Step 1 of the Template Builder workflow:
 * 1. Upload a finished voucher image (or front+back separately)
 * 2. Gemini removes all text, keeping only the design/background
 * 3. Output: Clean template base images ready for layer positioning
 */
export function TemplateCleaner({ onCleanedImage }: TemplateCleanerProps) {
  // Get API key from store
  const apiKey = useGeminiStore((state) => state.apiKey);
  const setApiKey = useGeminiStore((state) => state.setApiKey);
  const [localApiKey, setLocalApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const [mode, setMode] = useState<"combined" | "separate">("combined");
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceFront, setSourceFront] = useState<string | null>(null);
  const [sourceBack, setSourceBack] = useState<string | null>(null);
  const [cleanedImage, setCleanedImage] = useState<string | null>(null);
  const [cleanedFront, setCleanedFront] = useState<string | null>(null);
  const [cleanedBack, setCleanedBack] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  // Value change generation
  const [valueVariants, setValueVariants] = useState<Record<string, string>>({});
  const [isGeneratingValues, setIsGeneratingValues] = useState(false);
  const [valueProgress, setValueProgress] = useState<string>("");
  const [originalValue, setOriginalValue] = useState<string>("");
  const [targetValues, setTargetValues] = useState<string>("1, 5, 10, 50, 100");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "combined" | "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;

      if (target === "combined") {
        setSourceImage(base64);
        setCleanedImage(null);
      } else if (target === "front") {
        setSourceFront(base64);
        setCleanedFront(null);
      } else {
        setSourceBack(base64);
        setCleanedBack(null);
      }
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Clean image with Gemini
  const cleanImage = async (imageBase64: string, side: "combined" | "front" | "back"): Promise<CleaningResult> => {
    const base64Data = imageBase64.split(",")[1] || imageBase64;

    const prompt = side === "combined"
      ? `Dies ist ein Gutschein-Bild im 1:1 Format. Die obere Hälfte ist die Vorderseite, die untere Hälfte ist die Rückseite.

AUFGABE: Entferne ALLE Texte, Zahlen, Namen, Werte und Beschriftungen aus dem Bild.

WICHTIG:
- Entferne JEDEN Text (Namen, Werte wie "50€" oder "1 Stunde", Telefonnummern, E-Mails, Überschriften, etc.)
- Entferne auch kleine Zahlen in Ecken/Badges
- Behalte das komplette Design bei (Farben, Muster, Rahmen, Ornamente, Hintergründe)
- Behalte Portraits/Fotos von Personen bei (nur den Text darüber/darunter entfernen)
- Fülle die Stellen wo Text war mit dem passenden Hintergrund/Design auf
- Das Ergebnis soll wie eine "leere Vorlage" aussehen, bereit für neue Texte

Gib NUR das bereinigte Bild zurück, ohne Erklärungen.`
      : `Dies ist die ${side === "front" ? "Vorderseite" : "Rückseite"} eines Gutscheins.

AUFGABE: Entferne ALLE Texte, Zahlen, Namen, Werte und Beschriftungen aus dem Bild.

WICHTIG:
- Entferne JEDEN Text (Namen, Werte wie "50€" oder "1 Stunde", Telefonnummern, E-Mails, Überschriften, etc.)
- Entferne auch kleine Zahlen in Ecken/Badges
- Behalte das komplette Design bei (Farben, Muster, Rahmen, Ornamente, Hintergründe)
- Behalte Portraits/Fotos von Personen bei (nur den Text darüber/darunter entfernen)
- Fülle die Stellen wo Text war mit dem passenden Hintergrund/Design auf
- Das Ergebnis soll wie eine "leere Vorlage" aussehen, bereit für neue Texte

Gib NUR das bereinigte Bild zurück, ohne Erklärungen.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: "image/png",
                      data: base64Data,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: {
                imageSize: "4K",
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API Error: ${response.status} ${errorText}` };
      }

      const data = await response.json();

      // Check for errors
      if (data.candidates?.[0]?.finishReason === "SAFETY") {
        return { success: false, error: "Content blocked by safety filters" };
      }

      // Extract image from response
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(
        (part: { inlineData?: { mimeType: string; data: string } }) =>
          part.inlineData?.mimeType?.startsWith("image/")
      );

      if (!imagePart?.inlineData?.data) {
        const textPart = parts.find((p: { text?: string }) => p.text);
        return {
          success: false,
          error: `No image returned: ${textPart?.text || "Unknown error"}`,
        };
      }

      return {
        success: true,
        imageBase64: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  };

  // Generate value variant - change value from original to target
  const generateValueVariant = async (
    originalImage: string,
    fromValue: string,
    toValue: string
  ): Promise<CleaningResult> => {
    const base64Data = originalImage.split(",")[1] || originalImage;

    const prompt = `Dies ist ein Gutschein-Bild. Der aktuelle Wert ist "${fromValue}".

AUFGABE: Ändere den Wert von "${fromValue}" zu "${toValue}".

REGELN:
- Ersetze ALLE Vorkommen von "${fromValue}" durch "${toValue}" (Hauptwert, Eck-Zahlen, Badges, überall)
- Behalte den EXAKT GLEICHEN Stil: Schriftart, Größe, Position, Farbe, Verzierungen, Effekte
- Der gesamte Rest des Bildes muss 100% IDENTISCH bleiben
- Wenn der Wert auf der Vorder- UND Rückseite vorkommt, ändere beide

Gib das modifizierte Bild zurück.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: "image/png",
                      data: base64Data,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: {
                imageSize: "4K",
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API Error: ${response.status} ${errorText}` };
      }

      const data = await response.json();

      if (data.candidates?.[0]?.finishReason === "SAFETY") {
        return { success: false, error: "Content blocked by safety filters" };
      }

      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(
        (part: { inlineData?: { mimeType: string; data: string } }) =>
          part.inlineData?.mimeType?.startsWith("image/")
      );

      if (!imagePart?.inlineData?.data) {
        const textPart = parts.find((p: { text?: string }) => p.text);
        return {
          success: false,
          error: `No image returned: ${textPart?.text || "Unknown error"}`,
        };
      }

      return {
        success: true,
        imageBase64: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  };

  // Generate all value variants
  const handleGenerateValueVariants = async () => {
    if (!apiKey || !sourceImage || !originalValue.trim()) {
      setError("API Key, Original-Bild und Original-Wert erforderlich");
      return;
    }

    const targets = targetValues.split(",").map((v) => v.trim()).filter(Boolean);
    if (targets.length === 0) {
      setError("Mindestens ein Ziel-Wert erforderlich");
      return;
    }

    setIsGeneratingValues(true);
    setError(null);
    const newVariants: Record<string, string> = {};

    try {
      for (const target of targets) {
        setValueProgress(`Ändere "${originalValue}" → "${target}"...`);
        const result = await generateValueVariant(sourceImage, originalValue.trim(), target);

        if (result.success && result.imageBase64) {
          newVariants[target] = result.imageBase64;
          setValueVariants({ ...newVariants });
        } else {
          setError(`Fehler bei "${target}": ${result.error}`);
          break;
        }
      }
    } finally {
      setIsGeneratingValues(false);
      setValueProgress("");
    }
  };

  // Process the image(s)
  const handleClean = async () => {
    if (!apiKey) {
      setError("API Key erforderlich");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (mode === "combined" && sourceImage) {
        setProgress("Bereinige Gutschein-Bild...");
        const result = await cleanImage(sourceImage, "combined");

        if (result.success && result.imageBase64) {
          setCleanedImage(result.imageBase64);
          onCleanedImage(result.imageBase64, null);
        } else {
          setError(result.error || "Cleaning failed");
        }
      } else if (mode === "separate") {
        if (sourceFront) {
          setProgress("Bereinige Vorderseite...");
          const frontResult = await cleanImage(sourceFront, "front");
          if (frontResult.success && frontResult.imageBase64) {
            setCleanedFront(frontResult.imageBase64);
          } else {
            setError(`Vorderseite: ${frontResult.error}`);
            setIsProcessing(false);
            return;
          }
        }

        if (sourceBack) {
          setProgress("Bereinige Rückseite...");
          const backResult = await cleanImage(sourceBack, "back");
          if (backResult.success && backResult.imageBase64) {
            setCleanedBack(backResult.imageBase64);
          } else {
            setError(`Rückseite: ${backResult.error}`);
            setIsProcessing(false);
            return;
          }
        }

        // Call callback with results
        if (cleanedFront || cleanedBack) {
          onCleanedImage(cleanedFront || "", cleanedBack || null);
        }
      }
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  };

  const canProcess =
    mode === "combined" ? !!sourceImage : !!(sourceFront || sourceBack);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Template Cleaner</h2>
        <p className="text-gray-600">
          Schritt 1: Entferne alle Texte aus einem fertigen Gutschein
        </p>
      </div>

      {/* Mode Selection */}
      <div className="flex justify-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            checked={mode === "combined"}
            onChange={() => setMode("combined")}
            className="radio radio-primary"
          />
          <span>Kombiniertes Bild (1:1 mit Vorder- & Rückseite)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            checked={mode === "separate"}
            onChange={() => setMode("separate")}
            className="radio radio-primary"
          />
          <span>Separate Bilder</span>
        </label>
      </div>

      {/* Upload Section */}
      {mode === "combined" ? (
        <div className="grid grid-cols-2 gap-6">
          {/* Source Image */}
          <div className="space-y-2">
            <h3 className="font-semibold text-center">Original</h3>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[200px] flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {sourceImage ? (
                <img
                  src={sourceImage}
                  alt="Original"
                  className="max-w-full max-h-[300px] object-contain"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p>Klicken zum Hochladen</p>
                  <p className="text-sm">(1:1 Format mit Vorder- & Rückseite)</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "combined")}
            />
          </div>

          {/* Cleaned Result */}
          <div className="space-y-2">
            <h3 className="font-semibold text-center">Bereinigt</h3>
            <div className="border-2 border-gray-200 rounded-lg p-4 min-h-[200px] flex items-center justify-center bg-gray-50">
              {cleanedImage ? (
                <img
                  src={cleanedImage}
                  alt="Bereinigt"
                  className="max-w-full max-h-[300px] object-contain"
                />
              ) : (
                <div className="text-center text-gray-400">
                  {isProcessing ? (
                    <>
                      <span className="loading loading-spinner loading-lg"></span>
                      <p className="mt-2">{progress}</p>
                    </>
                  ) : (
                    <p>Ergebnis erscheint hier</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Front Side */}
          <div className="space-y-4">
            <h3 className="font-semibold text-center">Vorderseite</h3>
            <div className="grid grid-cols-2 gap-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-2 min-h-[150px] flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => frontInputRef.current?.click()}
              >
                {sourceFront ? (
                  <img src={sourceFront} alt="Front Original" className="max-w-full max-h-[140px] object-contain" />
                ) : (
                  <span className="text-gray-500 text-sm">Original</span>
                )}
              </div>
              <div className="border-2 border-gray-200 rounded-lg p-2 min-h-[150px] flex items-center justify-center bg-gray-50">
                {cleanedFront ? (
                  <img src={cleanedFront} alt="Front Bereinigt" className="max-w-full max-h-[140px] object-contain" />
                ) : (
                  <span className="text-gray-400 text-sm">Bereinigt</span>
                )}
              </div>
            </div>
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "front")}
            />
          </div>

          {/* Back Side */}
          <div className="space-y-4">
            <h3 className="font-semibold text-center">Rückseite</h3>
            <div className="grid grid-cols-2 gap-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-2 min-h-[150px] flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => backInputRef.current?.click()}
              >
                {sourceBack ? (
                  <img src={sourceBack} alt="Back Original" className="max-w-full max-h-[140px] object-contain" />
                ) : (
                  <span className="text-gray-500 text-sm">Original</span>
                )}
              </div>
              <div className="border-2 border-gray-200 rounded-lg p-2 min-h-[150px] flex items-center justify-center bg-gray-50">
                {cleanedBack ? (
                  <img src={cleanedBack} alt="Back Bereinigt" className="max-w-full max-h-[140px] object-contain" />
                ) : (
                  <span className="text-gray-400 text-sm">Bereinigt</span>
                )}
              </div>
            </div>
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "back")}
            />
          </div>
        </div>
      )}

      {/* API Key Section */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${apiKey ? "text-success" : "text-warning"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              <span className="font-medium">
                Gemini API Key: {apiKey ? "✓ Gespeichert" : "Nicht gesetzt"}
              </span>
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setShowApiKeyInput(!showApiKeyInput);
                if (!showApiKeyInput) {
                  setLocalApiKey(apiKey);
                }
              }}
            >
              {showApiKeyInput ? "Schließen" : apiKey ? "Ändern" : "Eingeben"}
            </button>
          </div>

          {showApiKeyInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                className="input input-bordered flex-1"
                placeholder="AIza..."
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && localApiKey.trim()) {
                    setApiKey(localApiKey.trim());
                    setShowApiKeyInput(false);
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (localApiKey.trim()) {
                    setApiKey(localApiKey.trim());
                    setShowApiKeyInput(false);
                  }
                }}
                disabled={!localApiKey.trim()}
              >
                Speichern
              </button>
            </div>
          )}

          {!apiKey && !showApiKeyInput && (
            <p className="text-sm text-gray-500 mt-1">
              Du benötigst einen Gemini API Key von{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary"
              >
                Google AI Studio
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleClean}
          disabled={!canProcess || isProcessing || !apiKey}
        >
          {isProcessing ? (
            <>
              <span className="loading loading-spinner"></span>
              {progress || "Verarbeite..."}
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Texte entfernen
            </>
          )}
        </button>
      </div>

      {/* Download cleaned images */}
      {(cleanedImage || cleanedFront || cleanedBack) && (
        <div className="flex justify-center gap-4">
          {cleanedImage && (
            <a
              href={cleanedImage}
              download="template-clean.png"
              className="btn btn-outline btn-sm"
            >
              Download Bereinigt
            </a>
          )}
          {cleanedFront && (
            <a
              href={cleanedFront}
              download="template-front.png"
              className="btn btn-outline btn-sm"
            >
              Download Vorderseite
            </a>
          )}
          {cleanedBack && (
            <a
              href={cleanedBack}
              download="template-back.png"
              className="btn btn-outline btn-sm"
            >
              Download Rückseite
            </a>
          )}
        </div>
      )}

      {/* Value Variants Generation */}
      {sourceImage && (
        <div className="card bg-base-100 shadow-sm mt-6">
          <div className="card-body">
            <h3 className="card-title text-lg">
              Schritt 2: Wert-Varianten generieren
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Ändere den Gutschein-Wert und generiere verschiedene Varianten
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">
                  <span className="label-text font-medium">Original-Wert im Bild</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="z.B. 50 Euro, 1 Stunde, 6 Brötchen"
                  value={originalValue}
                  onChange={(e) => setOriginalValue(e.target.value)}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text font-medium">Ziel-Werte (kommagetrennt)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="z.B. 1, 5, 10, 50, 100"
                  value={targetValues}
                  onChange={(e) => setTargetValues(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleGenerateValueVariants}
              disabled={isGeneratingValues || !apiKey || !originalValue.trim()}
            >
              {isGeneratingValues ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  {valueProgress}
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                    />
                  </svg>
                  Wert-Varianten generieren
                </>
              )}
            </button>

            {/* Display generated value variants */}
            {Object.keys(valueVariants).length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Generierte Varianten:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Object.entries(valueVariants).map(([value, imageBase64]) => (
                    <div key={value} className="text-center">
                      <div className="border rounded-lg p-2 bg-gray-100">
                        <img
                          src={imageBase64}
                          alt={`Wert ${value}`}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                      <span className="text-sm font-medium block mt-1">{value}</span>
                      <a
                        href={imageBase64}
                        download={`voucher-${value.replace(/\s+/g, "-")}.png`}
                        className="btn btn-xs btn-ghost block mt-1"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
