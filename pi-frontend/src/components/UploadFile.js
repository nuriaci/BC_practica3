import React, { useState } from "react";
import { create } from "kubo-rpc-client"; // Cliente IPFS de Kubo
import { ethers } from "ethers";
import { Buffer } from "buffer";
import { addresses, abis } from "../contracts"; // Contratos
import { toast } from 'react-toastify'; // Importar la función de Toastify
import 'react-toastify/dist/ReactToastify.css'; // Importar los estilos de Toastify
import CryptoJS from 'crypto-js';


// Función auxiliar para convertir WordArray a Uint8Array
const wordArrayToUint8Array = (wordArray) => {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
  }
  return u8;
};

// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);

// Instancia del contrato en Ethereum
const registroContract = new ethers.Contract(
  addresses.ipfs, // Dirección del contrato de registro
  abis.ipfs,      // ABI del contrato de registro
  defaultProvider
);

function UploadFile({ closeModal }) {
  const [file, setFile] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Leer y convertir el archivo seleccionado
  const retrieveFile = (e) => {
    const data = e.target.files[0];

    if (data && data instanceof Blob) {
      const reader = new FileReader();

      reader.onloadend = () => {
        const fileArrayBuffer = reader.result;
        const fileUint8Array = new Uint8Array(fileArrayBuffer);
        setFile({ content: fileUint8Array, mime: data.type });  // Guardamos el archivo binario y su tipo MIME
        console.log(data.type)
      };

      reader.readAsArrayBuffer(data);  // Leer el archivo como ArrayBuffer (binario)
    } else {
      toast.error("Por favor selecciona un archivo válido.");
    }
    e.preventDefault();
  };

  const checkMetaMaskConnection = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask no está instalada.");
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length === 0) {
        throw new Error("MetaMask no está conectada.");
      }

      return accounts[0]; // Devuelve la dirección de la cuenta conectada
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const cipherFile = (file) => {
    if (!file || !file.content || !file.mime) {
      throw new Error("El archivo no es válido o está vacío.");
    }

    // Generar una clave aleatoria de 32 bytes (256 bits)
    const key = CryptoJS.lib.WordArray.random(32); // 32 bytes = 256 bits
    console.log(key)

    const keyHex = CryptoJS.enc.Hex.stringify(key); // Convertir clave a hexadecimal para almacenamiento

    if (!keyHex || keyHex.length !== 64) {
      throw new Error("La clave generada no es válida.");
    }

    console.log("Clave generada (hex):", keyHex);

    // Generar un IV aleatorio (16 bytes para AES)
    const iv = CryptoJS.lib.WordArray.random(16); // 16 bytes = 128 bits
    console.log("IV generado (hex):", CryptoJS.enc.Hex.stringify(iv));

    // Convertir Uint8Array a WordArray
    const wordArray = CryptoJS.lib.WordArray.create(file.content);
    console.log(wordArray)

    // Cifrar el archivo usando AES con el WordArray de la clave
    const encrypted = CryptoJS.AES.encrypt(wordArray, keyHex, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7, // Añadir relleno (padding) si el tamaño no es múltiplo de 16
    });
    console.log("Archivo cifrado:", encrypted.toString());


    if (!encrypted) {
      throw new Error("El archivo no se pudo cifrar.");
    }

    // Convertir el ciphertext a Uint8Array
    const cipheredFileUint8Array = wordArrayToUint8Array(encrypted.ciphertext);
    console.log("Archivo cifrado (Uint8Array):", cipheredFileUint8Array);

    // Convertir a Buffer para almacenarlo en IPFS
    const cipheredFileBuffer = Buffer.from(cipheredFileUint8Array);
    console.log("Buffer del archivo cifrado:", cipheredFileBuffer);

    // Retornar tanto el archivo cifrado como la clave y el IV
    return {
      cipheredFileBuffer,
      key: keyHex,
      iv: CryptoJS.enc.Hex.stringify(iv) // Pasar el IV como string hexadecimal para almacenarlo 
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file || !titulo || !descripcion) {
      toast.error("Por favor completa todos los campos."); // Notificación de error
      return;
    }

    setIsUploading(true);
    setErrorMessage(""); // Reiniciar mensajes de error

    try {
      const account = await checkMetaMaskConnection();
      console.log(`Conectado a MetaMask con la cuenta: ${account}`);
      console.log(file)
      const { cipheredFileBuffer, key, iv } = cipherFile(file);

      const keyBuffer = Buffer.from(key, 'hex'); // Convierte clave a Buffer
      if (keyBuffer.length !== 32) {
        throw new Error("La clave no tiene exactamente 32 bytes.");
      }

      const keyHex = `0x${key}`; // Agregar el prefijo 0x

      // Cliente IPFS (conexión a tu nodo local)
      const client = await create("/ip4/127.0.0.1/tcp/5002"); // Conexión IPFS local

      // Subir el archivo cifrado a IPFS
      const result = await client.add(cipheredFileBuffer);
      console.log("Archivo subido a IPFS:", result);

      // Registrar el archivo en el contrato de Ethereum
      const signer = defaultProvider.getSigner();
      const contratoConSigner = registroContract.connect(signer);
      const tx = await contratoConSigner.registro(
        result.cid.toString(), // Hash del archivo IPFS
        titulo,                // Título del archivo
        descripcion,           // Descripción del archivo
        keyHex,                // Clave cifrada
        iv,                    // IV asociado
        file.mime              // Tipo MIME del archivo
      );
      await tx.wait(); // Esperar confirmación de la transacción
      setIpfsHash(result.cid.toString());
      toast.success(`Archivo subido y registrado con éxito: ${result.cid.toString()}`); // Notificación de éxito
      closeModal(); // Cerrar el modal después de subir el archivo
    } catch (error) {
      console.error("Error al subir el archivo:", error.message);
      toast.error(`Hubo un problema al procesar tu solicitud: ${error.message}`); // Notificación de error
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-blue-gray-900 text-white rounded-lg shadow-lg p-8 w-96 relative">
        <button
          onClick={closeModal}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-lg"
        >
          &times;
        </button>
        <h2 className="text-2xl font-light mb-4">Registrar archivo</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="file"
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-500 file:text-white hover:file:bg-teal-600"
            onChange={retrieveFile}
          />
          <input
            type="text"
            placeholder="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="block w-full text-sm bg-gray-800 text-white p-2 mt-4 rounded"
            required
          />
          <textarea
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
            required
          />
          <button
            type="submit"
            className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
          >
            {isUploading ? "Subiendo..." : "Registrar"}
          </button>
        </form>

        {/* Mensajes de éxito y error */}
        {ipfsHash && (
          <p className="mt-4 text-green-600">
            Archivo subido con éxito:{" "}
            <a
              href={`https://webui.ipfs.io/#/files/${ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500"
            >
              {ipfsHash}
            </a>
          </p>
        )}
        {errorMessage && <p className="mt-4 text-red-600">{errorMessage}</p>}
      </div>
    </div>
  );
}

export default UploadFile;