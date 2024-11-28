import React, { useState } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);

// Instancia del contrato en Ethereum
const disputaContract = new ethers.Contract(
    addresses.ipfs, // Dirección del contrato
    abis.ipfs,      // ABI del contrato
    defaultProvider
);

function RegistrarDisputa({ closeModal }) {
    const [tokenId, setTokenId] = useState("");
    const [motivo, setMotivo] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Registrar una disputa en el contrato
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!tokenId || !motivo) {
            toast.error("Por favor completa todos los campos.");
            return;
        }

        setIsSubmitting(true);

        try {
            const signer = defaultProvider.getSigner();
            const contratoConSigner = disputaContract.connect(signer);

            // Llamada al contrato inteligente
            const tx = await contratoConSigner.registrarDisputa(
                tokenId,
                motivo
            );
            await tx.wait();

            toast.success(`Disputa registrada con éxito para el token ${tokenId}`);
            closeModal(); // Cerrar modal después de registrar la disputa
        } catch (error) {
            console.error("Error al registrar la disputa:", error.message);
            toast.error("Hubo un problema al procesar tu solicitud. Inténtalo nuevamente.");
        } finally {
            setIsSubmitting(false);
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
                <h2 className="text-2xl font-light mb-4">Registrar Disputa</h2>

                <form onSubmit={handleSubmit}>
                    <input
                        type="number"
                        placeholder="Token ID"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value)}
                        className="block w-full text-sm bg-gray-800 text-white p-2 mt-4 rounded"
                        required
                    />
                    <textarea
                        placeholder="Motivo de la disputa"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
                        required
                    />
                    <button
                        type="submit"
                        className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
                    >
                        {isSubmitting ? "Registrando..." : "Registrar Disputa"}
                    </button>
                </form>

                {/* Mensajes de éxito y error */}
                {isSubmitting && (
                    <p className="mt-4 text-green-600">Procesando la solicitud...</p>
                )}
            </div>
        </div>
    );
}

export default RegistrarDisputa;
