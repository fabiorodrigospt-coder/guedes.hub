'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const login = $('login'), workspace = $('workspace');
  const loginForm = $('loginForm'), forgot = $('forgotPassword');
  const panel = $('passwordRecovery'), requestForm = $('recoveryRequestForm');
  const updateForm = $('recoveryUpdateForm'), status = $('recoveryStatus');
  const back = $('recoveryBack');
  if (!window.GHCloud || !login || !panel) return;
  let busy = false;
  const setStatus = text => { status.textContent = text; };
  function showRequest() {
    login.hidden = false; workspace.hidden = true;
    loginForm.hidden = true; forgot.hidden = true; $('loginError').textContent = '';
    panel.hidden = false; requestForm.hidden = false; updateForm.hidden = true;
    $('recoveryTitle').textContent = 'Recuperar senha';
    $('recoveryIntro').textContent = 'Informe o e-mail real cadastrado. Se ele estiver vinculado ao Guedes Hub, enviaremos um link.';
    setStatus('');
    $('recoveryEmail').focus();
  }
  function showUpdate() {
    login.hidden = false; workspace.hidden = true;
    loginForm.hidden = true; forgot.hidden = true;
    panel.hidden = false; requestForm.hidden = true; updateForm.hidden = false;
    $('recoveryTitle').textContent = 'Definir nova senha';
    $('recoveryIntro').textContent = 'Escolha uma senha nova para sua conta. O link de recuperação é válido por tempo limitado.';
    setStatus('');
    $('newPassword').focus();
  }
  function restoreLogin(message = '') {
    panel.hidden = true; requestForm.hidden = false; updateForm.hidden = true;
    $('recoveryTitle').textContent = 'Recuperar senha';
    $('recoveryIntro').textContent = 'Informe o e-mail real cadastrado. Se ele estiver vinculado ao Guedes Hub, enviaremos um link.';
    $('recoveryEmail').value = ''; $('newPassword').value = ''; $('confirmNewPassword').value = '';
    loginForm.hidden = false; forgot.hidden = false; $('loginError').textContent = message;
    login.hidden = false; workspace.hidden = true;
    setStatus('');
  }
  forgot.addEventListener('click', showRequest);
  back.addEventListener('click', async () => {
    if (window.GHCloud.passwordRecoveryActive() || new URLSearchParams(window.location.search).has('code') || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
      try { await window.GHCloud.finishPasswordRecovery(); } catch {}
    }
    restoreLogin();
  });
  requestForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !requestForm.reportValidity()) return;
    busy = true; $('sendRecovery').disabled = true;
    setStatus('Solicitando o link…');
    try {
      await window.GHCloud.requestPasswordRecovery($('recoveryEmail').value.trim());
      setStatus('Se este e-mail estiver cadastrado, o link de recuperação será enviado. Confira a caixa de entrada e o spam.');
    } catch (error) {
      const message = String(error?.message || '');
      setStatus(/redirect|url/i.test(message)
        ? 'O endereço de retorno ainda precisa ser autorizado na configuração do Supabase.'
        : 'Não foi possível solicitar agora. Confira a conexão e tente novamente mais tarde.');
    } finally {
      busy = false; $('sendRecovery').disabled = false;
    }
  });
  updateForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !updateForm.reportValidity()) return;
    const password = $('newPassword').value;
    if (password !== $('confirmNewPassword').value) {
      setStatus('As senhas não coincidem. Confira os dois campos.');
      $('confirmNewPassword').focus();
      return;
    }
    busy = true; $('saveNewPassword').disabled = true;
    setStatus('Salvando a nova senha…');
    try {
      await window.GHCloud.updatePassword(password);
      $('newPassword').value = ''; $('confirmNewPassword').value = '';
      try { await window.GHCloud.finishPasswordRecovery(); } catch {}
      updateForm.hidden = true;
      $('recoveryTitle').textContent = 'Senha atualizada';
      $('recoveryIntro').textContent = 'Sua senha foi alterada. Volte ao login e entre com a nova senha.';
      setStatus('Alteração concluída.');
    } catch {
      setStatus('Não foi possível alterar a senha. O link pode ter expirado; solicite outro.');
    } finally {
      busy = false; $('saveNewPassword').disabled = false;
    }
  });
  window.addEventListener('gh-password-recovery', showUpdate);
  if (window.GHCloud.passwordRecoveryActive()) showUpdate();
  else if (new URLSearchParams(window.location.search).has('code') || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
    showRequest();
    requestForm.hidden = true;
    setStatus('Validando o link de recuperação…');
    setTimeout(() => {
      if (!window.GHCloud.passwordRecoveryActive()) setStatus('Não foi possível validar o link. Ele pode ter expirado; solicite outro.');
    }, 8000);
  }
})();