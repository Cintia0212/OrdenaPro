package com.ordenapro.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.widget.Toast;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView webView;
    private SpeechRecognizer speechRecognizer;
    private static final int AUDIO_PERMISSION_REQUEST = 402;
    private boolean waitingForSpeech = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new VoiceBridge(this), "AndroidVoice");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void startNativeSpeech() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
            waitingForSpeech = true;
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendStatus("Este móvil no tiene un servicio de reconocimiento de voz disponible.");
            return;
        }
        stopNativeSpeech();
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) { sendStatus("Escuchando… habla ahora."); }
            @Override public void onBeginningOfSpeech() { }
            @Override public void onRmsChanged(float rmsdB) { }
            @Override public void onBufferReceived(byte[] buffer) { }
            @Override public void onEndOfSpeech() { sendStatus("Procesando voz…"); }
            @Override public void onError(int error) { sendStatus("No se ha reconocido la voz. Puedes intentarlo otra vez o escribir el texto."); stopNativeSpeech(); }
            @Override public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) sendResult(matches.get(0));
                sendStatus("Dictado finalizado. Revisa la transcripción.");
                stopNativeSpeech();
            }
            @Override public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) sendPartial(matches.get(0));
            }
            @Override public void onEvent(int eventType, Bundle params) { }
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-ES");
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try { speechRecognizer.startListening(intent); }
        catch (Exception e) { sendStatus("No se pudo iniciar el micrófono. Comprueba los permisos y el servicio de voz del móvil."); }
    }

    private void sendResult(String text) { callJs("window.onNativeVoiceResult(" + JSONObject.quote(text) + ")"); }
    private void sendPartial(String text) { callJs("window.onNativeVoicePartial(" + JSONObject.quote(text) + ")"); }
    private void sendStatus(String text) { callJs("window.onNativeVoiceStatus(" + JSONObject.quote(text) + ")"); }
    private void callJs(String script) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(script, null); }); }

    private void stopNativeSpeech() {
        if (speechRecognizer != null) {
            try { speechRecognizer.stopListening(); } catch (Exception ignored) { }
            try { speechRecognizer.destroy(); } catch (Exception ignored) { }
            speechRecognizer = null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == AUDIO_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (waitingForSpeech) { waitingForSpeech = false; startNativeSpeech(); }
            } else { waitingForSpeech = false; sendStatus("Permiso de micrófono denegado. Puedes escribir la descripción."); }
        }
    }

    @Override public void onDestroy() { stopNativeSpeech(); if (webView != null) webView.destroy(); super.onDestroy(); }

    public class VoiceBridge {
        private final Context context;
        VoiceBridge(Context context) { this.context = context; }
        @JavascriptInterface public void start() { runOnUiThread(() -> startNativeSpeech()); }
        @JavascriptInterface public void stop() { runOnUiThread(() -> stopNativeSpeech()); }
    }
}
