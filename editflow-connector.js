const uploadRequest = {
    eventType: 'omnidocs-edit-upload-request',
    editUrl: 'URL-for-co-editing'
};

const uploadResponse = {
    eventType: 'omnidocs-edit-upload-response',
    fileBase64: 'base64FileString',
    fileName: 'name'
};

const deliverResponse = {
    eventType: 'omnidocs-edit-deliver-response',
    downloadUrl: 'download-url'
}

const closeRequest = {
    eventType: 'omnidocs-edit-close-request'
};

const coEditingResponse = {
    eventType: 'omnidocs-edit-session-url-response',
    editUrl: ""
};

// PostMessage logic
const omnidocsEditFlowPostMessageModule = (function () {
    const popupNotOpenedError = 'Popup was not opened, make sure this function is run from a click action.';
    const features = 'menubar=no,location=no,resizable=yes,scrollbars=no,status=no,titlebar=no,toolbar=no' + `,left=${window.innerWidth * 0.5},width=900,height=1000,top=${window.innerHeight * 0.1}`;

    let popup;
    let popupUrl;

    console.log("popupUrl", popupUrl);

    function initiateConnection() {
        popupUrl = document.getElementById('edit-url').value;

        const abortController = new AbortController();
        let url = new URL(popupUrl);

        let resolveEditUrl;

        const editUrlPromise = new Promise((resolve, reject) => {
            resolveEditUrl = resolve;
            /*
             abortController.signal.addEventListener('abort', (e) =>
                reject(e.currentTarget.reason)
            );
            */
        });

        popup = openPopup(url, abortController);

        registerMessageHandler(url, resolveEditUrl, abortController.signal);

        return editUrlPromise;
    }

    function openPopup(url, abortController) {
        const openedPopup = window.open(url, '_blank', features);
        popup = openedPopup;

        if (!openedPopup) {
            abortController.abort(popupNotOpenedError);
            displayAuthResult.textContent = popupNotOpenedError;
            throw new Error(popupNotOpenedError);
        }

        const interval = setInterval(() => {
            if (openedPopup.closed) {
                abortController.abort('popup was closed');
                clearInterval(interval);
            }
        }, 200);

        return openedPopup;
    }

    function registerMessageHandler(
        popupUrl,
        resolveEditUrl,
        signal
    ) {
        window.addEventListener(
            'message',
            async (message) => {
                if (message.source.self !== popup) {
                    console.log("the message did not come from the original popup");
                    return;
                }

                const messageData = message.data;
                console.log("recieved messageData:", messageData);

                if (messageData.eventType === uploadRequest.eventType) {
                    console.log("Got in upload request");

                    let file = getFile();

                    if (!file) {
                        alert("Please select a .docx file first!");
                        return;
                    }

                    let fileBase64 = await convertFileToBase64(file);
                    let uploadResponse = makeUploadResponse(fileBase64, file);
                    console.log("sending response:", uploadResponse);
                    popup.postMessage(uploadResponse, popupUrl.origin);
                }

                if (messageData.eventType === coEditingResponse.eventType) {
                    var editUrlField = document.getElementById("co-edit-link");
                    editUrlField.value = messageData.editUrl;
                    resolveEditUrl = messageData.editUrl;
                }

                if (messageData.eventType === deliverResponse.eventType){
                    console.log("received download link");
                    var downloadUrlField = document.getElementById("download-link");
                    downloadUrlField.value = messageData.downloadUrl;
                }

                if (messageData.eventType === closeRequest.eventType) {
                    console.log("received omnidocs close request with data: ", messageData);
                    popup.close();
                }
            },
            { signal: signal }
        );
    }

    function getFile(){
        
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
    
        return file ?? null;
    }

    async function convertFileToBase64(file){
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove the data URL prefix to get only the base64 string
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = (error) => reject(error);
        });
    }

    function makeUploadResponse(base64File, file) {
        uploadResponse.fileBase64 = base64File;
        uploadResponse.fileName = file.name;
        uploadResponse.actionType = 'Edit';

        let additionalData = document.getElementById("edit-data").value;
        try {
            uploadResponse.additionalData = JSON.parse(additionalData);
        } catch (err) {
            console.error(`Could not parse data: \r\n${err}`);
        } 

        return uploadResponse;
    }

    return { initiateConnection };
})();
