// Global data storage for the workflow
let workflowData = {
    planejamento: {},
    triagem: {},
    execucao: {},
    supervisao: {},
    relatorios: {}
};

let currentPlanejamentoId = null;

// API base URL
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.workflow-nav .nav-button');
    const workflowSteps = document.querySelectorAll('.workflow-step');

    // Navigation between workflow steps
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetStep = button.dataset.step;
            switchToStep(targetStep);
        });
    });

    // Initialize form handlers
    initializePlanejamentoForm();
    initializeTriagemForm();
    initializeExecucaoForm();
    initializeSupervisaoForm();
    initializeRelatoriosForm();

    // Auto-calculate totals
    setupAutoCalculations();
});

function switchToStep(stepName) {
    const navButtons = document.querySelectorAll('.workflow-nav .nav-button');
    const workflowSteps = document.querySelectorAll('.workflow-step');

    // Remove 'active' class from all buttons and steps
    navButtons.forEach(btn => btn.classList.remove('active'));
    workflowSteps.forEach(step => step.classList.remove('active'));

    // Add 'active' class to the target button and step
    const targetButton = document.querySelector(`[data-step="${stepName}"]`);
    const targetStep = document.getElementById(stepName);
    
    if (targetButton && targetStep) {
        targetButton.classList.add('active');
        targetStep.classList.add('active');
    }

    // Update summary when switching to reports
    if (stepName === 'relatorios') {
        updateReportSummary();
    }
}

function initializePlanejamentoForm() {
    const form = document.querySelector('#planejamento form');
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Collect form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            try {
                // Send to backend API
                const response = await fetch(`${API_BASE}/planejamento`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Store in global workflow data
                    workflowData.planejamento = data;
                    currentPlanejamentoId = result.id;
                    
                    // Mark step as completed and advance
                    markStepCompleted('planejamento');
                    switchToStep('triagem');
                    
                    showNotification('Planejamento salvo com sucesso!', 'success');
                } else {
                    showNotification(result.error || 'Erro ao salvar planejamento', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Erro de conexão com o servidor', 'error');
            }
        });
    }
}

function initializeTriagemForm() {
    const advanceBtn = document.querySelector('#triagem .advance-btn');
    if (advanceBtn) {
        advanceBtn.addEventListener('click', async () => {
            if (!currentPlanejamentoId) {
                showNotification('Erro: ID do planejamento não encontrado', 'error');
                return;
            }
            
            const data = collectTriagemData();
            
            try {
                const response = await fetch(`${API_BASE}/triagem/${currentPlanejamentoId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    workflowData.triagem = data;
                    markStepCompleted('triagem');
                    switchToStep('execucao');
                    showNotification('Triagem concluída!', 'success');
                } else {
                    showNotification(result.error || 'Erro ao salvar triagem', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Erro de conexão com o servidor', 'error');
            }
        });
    }
}

function initializeExecucaoForm() {
    const advanceBtn = document.querySelector('#execucao .advance-btn');
    if (advanceBtn) {
        advanceBtn.addEventListener('click', async () => {
            if (!currentPlanejamentoId) {
                showNotification('Erro: ID do planejamento não encontrado', 'error');
                return;
            }
            
            const data = collectExecucaoData();
            
            try {
                const response = await fetch(`${API_BASE}/execucao/${currentPlanejamentoId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    workflowData.execucao = data;
                    markStepCompleted('execucao');
                    switchToStep('supervisao');
                    
                    // Update status indicators
                    updateStatusIndicators();
                    showNotification('Execução registrada!', 'success');
                } else {
                    showNotification(result.error || 'Erro ao salvar execução', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Erro de conexão com o servidor', 'error');
            }
        });
    }
}

function initializeSupervisaoForm() {
    const advanceBtn = document.querySelector('#supervisao .advance-btn');
    if (advanceBtn) {
        advanceBtn.addEventListener('click', async () => {
            if (!currentPlanejamentoId) {
                showNotification('Erro: ID do planejamento não encontrado', 'error');
                return;
            }
            
            const data = collectSupervisaoData();
            
            try {
                const response = await fetch(`${API_BASE}/supervisao/${currentPlanejamentoId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    workflowData.supervisao = data;
                    markStepCompleted('supervisao');
                    switchToStep('relatorios');
                    showNotification('Supervisão concluída!', 'success');
                } else {
                    showNotification(result.error || 'Erro ao salvar supervisão', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Erro de conexão com o servidor', 'error');
            }
        });
    }
}

function initializeRelatoriosForm() {
    const exportBtn = document.querySelector('.export-btn');
    const newEntryBtn = document.querySelector('.new-entry-btn');
    const finalizeBtn = document.querySelector('.finalize-btn');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportReport();
        });
    }

    if (newEntryBtn) {
        newEntryBtn.addEventListener('click', () => {
            resetWorkflow();
        });
    }

    if (finalizeBtn) {
        finalizeBtn.addEventListener('click', async () => {
            if (!currentPlanejamentoId) {
                showNotification('Erro: ID do planejamento não encontrado', 'error');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/relatorio/${currentPlanejamentoId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showNotification('Diário finalizado com sucesso!', 'success');
                    setTimeout(() => resetWorkflow(), 2000);
                } else {
                    showNotification(result.error || 'Erro ao finalizar diário', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Erro de conexão com o servidor', 'error');
            }
        });
    }
}

function setupAutoCalculations() {
    // Auto-calculate total protocols
    const protocolosPrazo = document.getElementById('protocolos_prazo');
    const protocolosVencidos = document.getElementById('protocolos_vencidos');
    const totalProtocolos = document.getElementById('total_protocolos');

    if (protocolosPrazo && protocolosVencidos && totalProtocolos) {
        [protocolosPrazo, protocolosVencidos].forEach(input => {
            input.addEventListener('input', () => {
                const prazo = parseInt(protocolosPrazo.value) || 0;
                const vencidos = parseInt(protocolosVencidos.value) || 0;
                totalProtocolos.value = prazo + vencidos;
            });
        });
    }
}

function collectTriagemData() {
    return {
        protocolos_prazo: parseInt(document.getElementById('protocolos_prazo').value) || 0,
        protocolos_vencidos: parseInt(document.getElementById('protocolos_vencidos').value) || 0,
        total_protocolos: parseInt(document.getElementById('total_protocolos').value) || 0,
        comentario_triagem: document.getElementById('comentario_triagem').value
    };
}

function collectExecucaoData() {
    return {
        atendido: parseInt(document.getElementById('atendido').value) || 0,
        impossibilidade: parseInt(document.getElementById('impossibilidade').value) || 0,
        nao_executado: parseInt(document.getElementById('nao_executado').value) || 0,
        comentario_execucao: document.getElementById('comentario_execucao').value
    };
}

function collectSupervisaoData() {
    return {
        comentario_supervisor: document.getElementById('comentario_supervisor').value
    };
}

function updateStatusIndicators() {
    const atendido = parseInt(workflowData.execucao.atendido) || 0;
    const total = parseInt(workflowData.triagem.total_protocolos) || 1;
    const impossibilidade = parseInt(workflowData.execucao.impossibilidade) || 0;

    const eficiencia = Math.round((atendido / total) * 100);
    
    document.getElementById('status_geral').textContent = 'Concluído';
    document.getElementById('eficiencia').textContent = `${eficiencia}%`;
    document.getElementById('problemas').textContent = impossibilidade > 0 ? `${impossibilidade} problemas` : 'Nenhum problema';
}

function updateReportSummary() {
    document.getElementById('summary_data').textContent = workflowData.planejamento.data || '--';
    document.getElementById('summary_turno').textContent = workflowData.planejamento.turno || '--';
    document.getElementById('summary_equipe').textContent = workflowData.planejamento.equipe || '--';
    document.getElementById('summary_total').textContent = workflowData.triagem.total_protocolos || '--';
    document.getElementById('summary_atendidos').textContent = workflowData.execucao.atendido || '--';
    document.getElementById('summary_impossibilidades').textContent = workflowData.execucao.impossibilidade || '--';
}

function markStepCompleted(stepName) {
    const button = document.querySelector(`[data-step="${stepName}"]`);
    if (button) {
        button.classList.add('completed');
    }
}

function exportReport() {
    const reportData = {
        ...workflowData,
        generated_at: new Date().toISOString(),
        planejamento_id: currentPlanejamentoId
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `diario_planejamento_${workflowData.planejamento.data || 'data'}.json`;
    link.click();
    
    showNotification('Relatório exportado!', 'success');
}

function resetWorkflow() {
    
    workflowData = {
        planejamento: {},
        triagem: {},
        execucao: {},
        supervisao: {},
        relatorios: {}
    };
    
    currentPlanejamentoId = null;
    
    // Reset all forms
    document.querySelectorAll('form').forEach(form => form.reset());
    document.querySelectorAll('input[type="number"]').forEach(input => input.value = '');
    document.querySelectorAll('textarea').forEach(textarea => textarea.value = '');
    
    // Reset navigation
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active', 'completed');
    });
    document.querySelectorAll('.workflow-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Activate first step
    switchToStep('planejamento');
    
    showNotification('Nova entrada iniciada!', 'info');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196f3'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove depois 3 de segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS para notificação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

